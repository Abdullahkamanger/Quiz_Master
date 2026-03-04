/*
 * Quiz_Master - script.js
 * A small beginner-friendly Quiz application that uses the
 * Open Trivia Database API to fetch categories and questions.
 *
 * This file has been lightly documented so new developers can
 * understand what each section does. No app logic has been
 * changed — only comments and structure for readability.
 */

// -----------------------------
// DOM Selections
// -----------------------------
// Select elements from the page that we will interact with.
const quizTopicsContainer = document.querySelector(".quiz-topic-wrapper-grid");
const quizStartBtns = document.querySelectorAll(".start-quiz-btn");
const quizQuestionsModel = document.querySelector(".quiz-questions-model");
const quizModalOverlay = document.querySelector(".quiz-model-info");
const quizTime = document.querySelector(".quiz-time");
const closeBtn = document.querySelectorAll(".close-btn");
const quizSubmitBtn = document.querySelector(".submit-answer-btn");
const scoreModal = document.querySelector(".score-model");
const scoreModalContent = document.querySelector(".score-model-content p");

// -----------------------------
// State variables
// -----------------------------
// These variables keep track of the current quiz state.
let currentQuestions = []; // array of questions fetched from API
let currentQuestionIndex = 0; // which question are we on (0-based)
let quizScore = 0; // user's current score
let timeLeft = 60; // time in seconds for each question
let timerInterval = null; // reference to the setInterval timer
let selectedAnswer = null; // the answer the user selected for the current question

// -----------------------------
// Fetch categories from the trivia API and render them
// -----------------------------
// We call the categories endpoint and create cards for each category.
const apiUrl = "https://opentdb.com/api_category.php";

fetch(apiUrl)
  .then((response) => response.json())
  .then((data) => {
    // Remove any placeholder content, then add cards for categories.
    quizTopicsContainer.innerHTML = "";

    // Each category becomes a card with a button to start that quiz.
    data.trivia_categories.forEach((category) => {
      const card = document.createElement("div");
      card.className = "quiz-topic-card";
      card.setAttribute("topic_id", category.id);
      card.innerHTML = `
                                <h2>${category.name}</h2>
                                <p>Challenge yourself with questions about ${category.name.toLowerCase()}, and more.</p>
                                <button class="start-quiz-btn" quiz_id="${category.id}">Start Quiz</button>
                        `;
      quizTopicsContainer.appendChild(card);
    });
  })
  .catch((error) => {
    // Log network errors to the console for debugging.
    console.error("Error fetching topics:", error);
  });

// -----------------------------
// Handle clicks on the category cards (delegated)
// -----------------------------
// We use one event listener on the container so dynamically-added
// buttons (from fetch) will still work.
quizTopicsContainer.addEventListener("click", (event) => {
  if (event.target.classList.contains("start-quiz-btn")) {
    const quizId = event.target.getAttribute("quiz_id");
    const quizTitle =
      event.target.parentElement.querySelector("h2").textContent;
    const quizDescription =
      event.target.parentElement.querySelector("p").textContent;

    // Show information about the selected quiz in a modal.
    showQuizInfoModal(quizTitle, quizDescription, quizId);
  }
});

// -----------------------------
// showQuizInfoModal
// Updates and displays the modal with quiz details and a start button.
// The start button is cloned to ensure it has no leftover event listeners
// from previous uses (cloning copies attributes/children but not listeners).
// -----------------------------
function showQuizInfoModal(title, description, categoryId) {
  const modalContent = quizModalOverlay.querySelector(".quiz-model-content");
  modalContent.querySelector("h2").textContent = title;
  modalContent.querySelector("p").textContent = description;

  // Set the category id on the modal's start button
  const startBtn = modalContent.querySelector(".start-quiz-btn");
  startBtn.setAttribute("quiz_id", categoryId);

  // Show the modal overlay
  quizModalOverlay.style.display = "flex";

  // Replace the button with a clone so any old click handlers are removed.
  const newStartBtn = startBtn.cloneNode(true);
  startBtn.parentNode.replaceChild(newStartBtn, startBtn);

  // Add a fresh click listener that starts the quiz and hides the modal.
  newStartBtn.addEventListener("click", () => {
    const categoryId = newStartBtn.getAttribute("quiz_id");
    startQuiz(categoryId);
    quizModalOverlay.style.display = "none";
  });
}

// -----------------------------
// startQuiz
// Reset state for a new quiz, fetch questions for the chosen category,
// then show the questions modal and render the first question.
// -----------------------------
function startQuiz(categoryId) {
  currentQuestionIndex = 0;
  quizScore = 0;

  const questionsApiUrl = `https://opentdb.com/api.php?amount=10&category=${categoryId}&type=multiple`;
  fetch(questionsApiUrl)
    .then((response) => response.json())
    .then((data) => {
      currentQuestions = data.results;
      displayQuestion();
      quizQuestionsModel.style.display = "flex";
    })
    .catch((error) => {
      console.error("Failed to fetch questions:", error);
    });
}

// -----------------------------
// displayQuestion
// Render the current question and its answers into the modal.
// Each answer becomes a radio input inside an <li>. We decode HTML entities
// (questions and answers often contain encoded characters) and shuffle
// the choices so the correct answer is not always in the same position.
// -----------------------------
function displayQuestion() {
  if (currentQuestionIndex >= currentQuestions.length) {
    // No more questions — show the final score.
    endQuiz();
    return;
  }

  const question = currentQuestions[currentQuestionIndex];
  const questionContent = quizQuestionsModel.querySelector(
    ".quiz-questions-content",
  );

  // Reset per-question timer
  timeLeft = 60;

  // Build the HTML for the question and its answers. We combine the
  // incorrect answers and the correct answer, shuffle them, map them
  // into <li> blocks and then join into a single string for insertion.
  questionContent.innerHTML = `
                <h1 class="quiz-time">1:00</h1>
                <span class="close-btn">&times;</span>
                <h2>Question ${currentQuestionIndex + 1} of ${currentQuestions.length}</h2>
                <p>${decodeHtml(question.question)}</p>
                <ul class="options-list">
                        ${[
                          ...question.incorrect_answers,
                          question.correct_answer,
                        ]
                          .sort(() => Math.random() - 0.5)
                          .map(
                            (answer, index) => `
                                        <li>
                                                <input type="radio" name="option" id="option${index}" value="${answer}">
                                                <label for="option${index}">${decodeHtml(answer)}</label>
                                        </li>
                                `,
                          )
                          .join("")}
                </ul>
                <button class="submit-answer-btn">Submit Answer</button>
        `;

  // Re-attach behaviors: close buttons, submit handler, option selection
  attachCloseButtons();

  const submitBtn = questionContent.querySelector(".submit-answer-btn");
  submitBtn.addEventListener("click", submitAnswer);

  const options = questionContent.querySelectorAll("input[name='option']");
  options.forEach((option) => {
    option.addEventListener("change", (e) => {
      selectedAnswer = e.target.value;
    });
  });

  // Start the countdown timer for this question
  startTimer();
}

// -----------------------------
// startTimer
// Count down once per second and update the displayed minutes:seconds.
// When time runs out we automatically advance to the next question.
// -----------------------------
function startTimer() {
  if (timerInterval) clearInterval(timerInterval);

  timerInterval = setInterval(() => {
    timeLeft--;
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    const timerDisplay = quizQuestionsModel.querySelector(".quiz-time");
    if (timerDisplay) {
      timerDisplay.textContent = `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
    }

    if (timeLeft <= 0) {
      clearInterval(timerInterval);
      autoNextQuestion();
    }
  }, 1000);
}

// -----------------------------
// submitAnswer
// Called when the user clicks the submit button. We stop the timer,
// validate that an option was selected, check correctness, update score,
// then move to the next question after a short delay.
// -----------------------------
function submitAnswer() {
  clearInterval(timerInterval);

  if (selectedAnswer === null) {
    alert("Please select an answer!");
    return;
  }

  const question = currentQuestions[currentQuestionIndex];

  if (selectedAnswer === question.correct_answer) {
    quizScore++;
  }

  console.log(`Score: ${quizScore}`);

  // Reset selection and go to the next question
  selectedAnswer = null;
  currentQuestionIndex++;

  setTimeout(() => {
    displayQuestion();
  }, 500);
}

// -----------------------------
// autoNextQuestion
// Advance when time runs out. We keep the same behavior as submitAnswer
// but without checking an answer.
// -----------------------------
function autoNextQuestion() {
  selectedAnswer = null;
  currentQuestionIndex++;
  displayQuestion();
}

// -----------------------------
// endQuiz
// Hide the quiz modal and show the score modal with the user's results.
// -----------------------------
function endQuiz() {
  quizQuestionsModel.style.display = "none";

  const totalQuestions = currentQuestions.length;
  const percentage = Math.round((quizScore / totalQuestions) * 100);

  scoreModalContent.textContent = `You scored ${quizScore} out of ${totalQuestions}! (${percentage}%)`;
  scoreModal.style.display = "flex";
}

// -----------------------------
// attachCloseButtons
// Add click handlers to all elements with the class .close-btn so the
// user can cancel the quiz or the score modal. This also resets state.
// -----------------------------
function attachCloseButtons() {
  const closeButtons = quizQuestionsModel.querySelectorAll(".close-btn");
  closeButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      clearInterval(timerInterval);
      quizQuestionsModel.style.display = "none";
      scoreModal.style.display = "none";
      quizModalOverlay.style.display = "none";
      currentQuestionIndex = 0;
      quizScore = 0;
    });
  });
}

// Close score modal button (if present) — keep behavior identical to before.
const scoreCloseBtn = scoreModal.querySelector(".close-btn");
if (scoreCloseBtn) {
  scoreCloseBtn.addEventListener("click", () => {
    scoreModal.style.display = "none";
    currentQuestionIndex = 0;
    quizScore = 0;
  });
}

// Ensure close buttons are attached on load (for initial static HTML)
attachCloseButtons();

// -----------------------------
// Helper: decodeHtml
// The trivia API returns text with HTML entities (like &quot;). This small
// helper decodes entities so the user sees normal punctuation and symbols.
// -----------------------------
function decodeHtml(html) {
  const txt = document.createElement("textarea");
  txt.innerHTML = html;
  return txt.value;
}
