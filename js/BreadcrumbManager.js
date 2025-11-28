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
        // Infer the parent directory from the child's path
        const parentDir = childModulePath.substring(0, childModulePath.lastIndexOf('/'));
        if (!parentDir || parentDir === 'modules') { // Reached the top level directory
            return null;
        }

        // The convention is that the parent JSON file has the same name as its directory
        const parentModulePath = `${parentDir}.json`;

        if (this.allModulePaths.includes(parentModulePath)) {
            try {
                const parentModuleData = await this.moduleLoader.getModuleData(parentModulePath);
                if (!parentModuleData) return null;
                // Search the nodes in the parent module
                for (const nodeId in parentModuleData.nodes) {
                    const node = parentModuleData.nodes[nodeId];
                    // Find the node that links to our child module
                    if (node.subModule === childModulePath) {
                        return { parentModulePath, parentNodeId: nodeId };
                    }
                }
            } catch (error) {
                console.error(`Error loading or parsing parent module ${parentModulePath}:`, error);
                return null;
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
        // The moduleStack is the source of truth for the navigation history.
        const history = this.moduleLoader.state.moduleStack;
        const currentModuleData = await this.moduleLoader.getModuleData(targetModulePath);
        if (!currentModuleData) return [];

        // The breadcrumb trail consists of the modules in the history stack...
        const breadcrumbs = history.map(moduleInStack => ({
            title: moduleInStack.name,
            nodeId: 'root', // When navigating back to a module, we always go to its root.
            modulePath: moduleInStack.path
        }));

        // ...plus the current module itself.
        breadcrumbs.push({
            title: currentModuleData.name,
            nodeId: 'root',
            modulePath: targetModulePath
        });

        return breadcrumbs;
    }
}