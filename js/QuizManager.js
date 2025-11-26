export class QuizManager {
    constructor(state) {
        this.state = state;
        this.mindMapData = null;
        this.currentQuiz = [];
        this.currentQuestionIndex = 0;
        this.score = 0;

        this.quizContainer = document.getElementById('quiz-container');
        this.questionEl = document.getElementById('quiz-question');
        this.optionsEl = document.getElementById('quiz-options');
        this.feedbackEl = document.getElementById('quiz-feedback');
        this.scoreEl = document.getElementById('score'); // This ID seems to be missing in index.html, but let's fix the others first.
    }

    setMindMapData(data) {
        this.mindMapData = data;
    }

    startQuizForNode(nodeId) {
        const node = this.mindMapData.nodes[nodeId];
        if (!node || !node.quiz || node.quiz.length === 0) {
            this.quizContainer.classList.add('hidden');
            return;
        }

        this.currentQuiz = this.shuffleArray([...node.quiz]);
        this.currentQuestionIndex = 0;
        this.score = 0;
        this.quizContainer.classList.remove('hidden');
        this.displayQuestion();
    }

    displayQuestion() {
        this.feedbackEl.innerHTML = '';
        this.updateScore();

        if (this.currentQuestionIndex >= this.currentQuiz.length) {
            this.showFinalScore();
            return;
        }

        const q = this.currentQuiz[this.currentQuestionIndex];
        this.questionEl.textContent = q.question;
        this.optionsEl.innerHTML = '';
        
        const ul = document.createElement('ul');
        const options = this.shuffleArray([...q.options, q.answer]);

        options.forEach(option => {
            const li = document.createElement('li');
            const button = document.createElement('button');
            button.textContent = option;
            button.className = 'quiz-option';
            button.onclick = () => this.checkAnswer(option, q.answer);
            li.appendChild(button);
            ul.appendChild(li);
        });
        this.optionsEl.appendChild(ul);
    }

    checkAnswer(selectedOption, correctAnswer) {
        const isCorrect = selectedOption === correctAnswer;
        let feedbackHtml = '';

        if (isCorrect) {
            this.score++;
            feedbackHtml = '<p class="correct">Correct!</p>';
        } else {
            feedbackHtml = `<p class="incorrect">Incorrect. The correct answer was: ${correctAnswer}</p>`;
        }

        const nextButton = document.createElement('button');
        nextButton.textContent = 'Next Question';
        nextButton.className = 'button-primary'; // Use the standard primary button style
        nextButton.onclick = () => {
            this.currentQuestionIndex++;
            this.displayQuestion();
        };

        this.feedbackEl.innerHTML = feedbackHtml;
        this.feedbackEl.appendChild(nextButton);
        this.updateScore();

        // Disable option buttons after an answer is selected
        this.optionsEl.querySelectorAll('button').forEach(btn => {
            btn.disabled = true;
            if (btn.textContent === correctAnswer) {
                btn.parentElement.classList.add('correct-answer');
            }
        });
    }

    showFinalScore() {
        this.questionEl.textContent = 'Quiz Complete!';
        this.optionsEl.innerHTML = '';
        this.feedbackEl.innerHTML = `<p>Your final score is ${this.score} out of ${this.currentQuiz.length}.</p>`;
    }

    updateScore() {
        if (this.scoreEl) {
            this.scoreEl.textContent = `Score: ${this.score} / ${this.currentQuiz.length}`;
        }
    }

    shuffleArray(array) {
        for (let i = array.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [array[i], array[j]] = [array[j], array[i]];
        }
        return array;
    }
}