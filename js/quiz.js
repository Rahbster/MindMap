class QuizManager {
    constructor(appState) {
        this.state = appState;
        this.quizState = this.loadQuizState();

        this.questionEl = document.getElementById('quiz-question');
        this.optionsEl = document.getElementById('quiz-options');
        this.feedbackEl = document.getElementById('quiz-feedback');
        this.nextBtn = document.getElementById('next-question-btn');

    }

    loadQuizState() {
        const state = localStorage.getItem('mindmapQuizState');
        return state ? JSON.parse(state) : {};
    }

    saveQuizState() {
        localStorage.setItem('mindmapQuizState', JSON.stringify(this.quizState));
    }

    setMindMapData(mindMapData) {
        this.state.mindMapData = mindMapData;
    }

    startQuizForNode(nodeId) {
        this.nextBtn.classList.add('hidden');
        this.nextBtn.onclick = () => this.startQuizForNode(this.state.activeNodeId);
        this.presentQuestion();
    }

    presentQuestion() {
        const questionData = this.selectNextQuestion();
        if (!questionData) {
            this.questionEl.textContent = "You've completed all questions for this topic!";
            this.optionsEl.innerHTML = '';
            this.feedbackEl.textContent = '';
            return;
        }

        const { question, options } = questionData.question;
        this.currentAnswer = questionData.question.answer;

        this.questionEl.textContent = question;
        this.optionsEl.innerHTML = '';
        this.feedbackEl.textContent = '';

        options.forEach(optionText => {
            const button = document.createElement('button');
            button.textContent = optionText;
            button.className = 'quiz-option';
            button.onclick = () => this.handleAnswer(button, optionText, questionData.id);
            this.optionsEl.appendChild(button);
        });
    }

    handleAnswer(button, selectedOption, questionId) {
        // Disable all option buttons
        this.optionsEl.querySelectorAll('button').forEach(btn => btn.disabled = true);

        const isCorrect = selectedOption === this.currentAnswer;
        const stats = this.quizState[questionId];

        if (isCorrect) {
            button.classList.add('correct');
            this.feedbackEl.textContent = "Correct!";
            stats.correctStreak = (stats.correctStreak || 0) + 1;
        } else {
            button.classList.add('incorrect');
            this.feedbackEl.textContent = `Incorrect. The correct answer is: ${this.currentAnswer}`;
            stats.correctStreak = 0; // Reset streak on wrong answer
        }

        this.saveQuizState();
        this.nextBtn.classList.remove('hidden');
    }

    selectNextQuestion() {
        const questionsForNode = this.state.mindMapData.nodes[this.state.activeNodeId].quiz;
        if (!questionsForNode || questionsForNode.length === 0) return null;

        // Initialize state for any new questions
        questionsForNode.forEach((q, index) => {
            const questionId = `${this.state.activeNodeId}-q${index}`;
            if (!this.quizState[questionId]) {
                this.quizState[questionId] = {
                    timesPresented: 0,
                    correctStreak: 0
                };
            }
        });

        // Simple adaptive algorithm:
        // 1. Filter questions and assign a "priority score".
        //    Lower score is higher priority.
        // 2. Score = (correctStreak * 10) + timesPresented.
        //    This heavily prioritizes questions the user gets wrong.
        const scoredQuestions = questionsForNode.map((q, index) => {
            const questionId = `${this.state.activeNodeId}-q${index}`;
            const stats = this.quizState[questionId];
            const score = (stats.correctStreak * 10) + stats.timesPresented;
            return { id: questionId, question: q, score: score };
        });

        // Sort by score, lowest first
        scoredQuestions.sort((a, b) => a.score - b.score);

        const nextQuestion = scoredQuestions[0];
        this.quizState[nextQuestion.id].timesPresented++;
        return nextQuestion;
    }
}