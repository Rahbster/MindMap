export class BreadcrumbManager {
    constructor(allModulePaths, moduleLoader) {
        this.allModulePaths = allModulePaths;
        this.moduleLoader = moduleLoader;
    }

    /**
     * Finds the hierarchical path from the root to a target node within a single module's data.
     * @param {object} moduleData - The full parsed JSON object for a single module.
     * @param {string} targetNodeId - The ID of the node to find the path to.
     * @returns {Array<object>|null} An array of node objects representing the path, or null if not found.
     */
    _findPathWithinModule(moduleData, targetNodeId) {
        const nodes = moduleData.nodes;

        // Recursive search function (DFS)
        const search = (currentNodeId, currentPath) => {
            const currentNode = nodes[currentNodeId];
            if (!currentNode) return null; // Safety check

            const newPath = [...currentPath, currentNode];

            // Base Case: We found the target node.
            if (currentNodeId === targetNodeId) {
                return newPath;
            }

            // Recursive Step: Search through the children.
            if (currentNode.children && currentNode.children.length > 0) {
                for (const childId of currentNode.children) {
                    const foundPath = search(childId, newPath);
                    // If the path was found in a child branch, return it up the call stack.
                    if (foundPath) {
                        return foundPath;
                    }
                }
            }

            // Base Case: Target not found in this branch.
            return null;
        }

        return search('root', []);
    }

    /**
     * Finds the parent module and the specific node within it that links to the given child module.
     * @param {string} childModulePath - The file path of the submodule we're starting from.
     * @returns {Promise<object|null>} A promise that resolves to an object { parentModulePath, parentNodeId } or null.
     */
    async _findModuleParent(childModulePath) {
        // To find the parent, we must iterate through all available modules
        // and check if any of their nodes link to the child module.
        for (const potentialParentPath of this.allModulePaths) {
            // A module cannot be its own parent.
            if (potentialParentPath === childModulePath) {
                continue;
            }
            
            try {
                const parentModuleData = await this.moduleLoader.getModuleData(potentialParentPath);
                if (parentModuleData && parentModuleData.nodes) {
                    // Search the nodes in the potential parent module
                    for (const nodeId in parentModuleData.nodes) {
                        const node = parentModuleData.nodes[nodeId];
                        // If we find a node that links to our child module, we've found the parent.
                        if (node.subModule === childModulePath) {
                            return { parentModulePath: potentialParentPath, parentNodeId: nodeId };
                        }
                    }
                }
            } catch (error) {
                // This can happen if a module path is invalid, so we log it but continue searching.
                console.warn(`Error checking potential parent module ${potentialParentPath}:`, error);
            }
        }

        return null; // No parent found
    }

    /**
     * Generates the full breadcrumb path for a given node by ascending the module hierarchy.
     * @param {string} targetNodeId - The ID of the node selected from search.
     * @param {string} targetModulePath - The file path of the module containing the target node.
     * @returns {Promise<Array<object>>} A promise that resolves to an array of breadcrumb segment objects.
     */
    async generateBreadcrumbs(targetNodeId, targetModulePath) {
        let history = this.moduleLoader.state.moduleStack;

        // If the history is empty (e.g., after a search jump), we must rebuild it.
        if (history.length === 0 && targetModulePath) {
            const moduleHierarchy = [];
            let currentPath = targetModulePath;
            while (currentPath) {
                const parentInfo = await this._findModuleParent(currentPath);
                if (parentInfo) {
                    const parentModuleData = await this.moduleLoader.getModuleData(parentInfo.parentModulePath);
                    if (parentModuleData) {
                        moduleHierarchy.unshift({ name: parentModuleData.name, path: parentInfo.parentModulePath });
                    }
                    currentPath = parentInfo.parentModulePath;
                } else {
                    currentPath = null; // Reached the top or no parent found
                }
            }
            history = moduleHierarchy;
            // CRITICAL FIX: After rebuilding the history, we must update the application's
            // actual state so that subsequent breadcrumb clicks work correctly.
            this.moduleLoader.state.moduleStack = history;
        }

        const currentModuleData = await this.moduleLoader.getModuleData(targetModulePath);
        if (!currentModuleData) return [];

        // 1. Build the breadcrumbs from the module navigation history (either existing or rebuilt).
        let breadcrumbs = history.map(moduleInStack => ({
            title: moduleInStack.name,
            nodeId: 'root', // When navigating back to a module, we always go to its root.
            modulePath: moduleInStack.path
        }));

        const pathWithinModule = this._findPathWithinModule(currentModuleData, targetNodeId);

        if (pathWithinModule) {
            // 3. Convert the nodes in that path to breadcrumb segments and add them.
            // This correctly includes the module name itself (as the root of the path)
            // and any child nodes.
            const intraModuleCrumbs = pathWithinModule.map(node => ({
                title: node.title,
                nodeId: node.id,
                modulePath: targetModulePath // All these crumbs are in the same module.
            }));
            breadcrumbs = breadcrumbs.concat(intraModuleCrumbs);
        }

        return breadcrumbs; // Return the final combined breadcrumb trail.
    }
}