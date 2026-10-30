
/* =====================================================
   CODEQUEST 100
   Supabase Auth + Profile + Help Center + 300 Levels
   ===================================================== */

const SUPABASE_URL = "https://kidppesbsaxwhpynvvzk.supabase.co";
const SUPABASE_PUBLISHABLE_KEY =
  "sb_publishable__aYlyH5oN9a_bK_oivVv7g_zv8xiRFU";

const supabaseClient = window.supabase.createClient(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY
);

const $ = (id) => document.getElementById(id);

let currentUser = null;
let currentCourse = "c";
let currentDifficulty = "beginner";
let currentLevel = 1;
let answerPassed = false;

let isPasswordRecovery =
  window.location.hash.includes("type=recovery") ||
  new URLSearchParams(window.location.search).has("code");

const courses = {
  c: "C Programming",
  python: "Python",
  web: "Web Development"
};

const difficultyRanges = {
  beginner: [1, 30],
  medium: [31, 70],
  hard: [71, 100]
};

let progress = {
  c: { completed_levels: [], xp: 0 },
  python: { completed_levels: [], xp: 0 },
  web: { completed_levels: [], xp: 0 }
};

const authScreen = $("auth-screen");
const appScreen = $("app-screen");
const resetScreen = $("reset-screen");
const authMessage = $("auth-message");
const appMessage = $("app-message");
const profileMessage = $("profile-message");
const lessonMessage = $("lesson-message");

// ---------- GENERAL HELPERS ----------

function setMessage(element, message, error = false) {
  element.textContent = message;
  element.style.color = error ? "#ff9696" : "#4bd3a1";
}

function showLoginScreen(message = "") {
  authScreen.classList.remove("hidden");
  appScreen.classList.add("hidden");
  resetScreen.classList.add("hidden");
  $("login-form").classList.remove("hidden");
  $("register-form").classList.add("hidden");
  setMessage(authMessage, message);
}

function showRegisterScreen() {
  $("login-form").classList.add("hidden");
  $("register-form").classList.remove("hidden");
  setMessage(authMessage, "");
}

function showAppScreen() {
  authScreen.classList.add("hidden");
  resetScreen.classList.add("hidden");
  appScreen.classList.remove("hidden");
}

function showResetScreen(message = "") {
  authScreen.classList.add("hidden");
  appScreen.classList.add("hidden");
  resetScreen.classList.remove("hidden");
  setMessage($("reset-message"), message);
}

// ---------- AUTH SCREEN SWITCHING ----------

$("show-register").addEventListener("click", showRegisterScreen);
$("show-login").addEventListener("click", () => showLoginScreen());

// ---------- REGISTER ----------

$("register-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = $("reg-name").value.trim();
  const email = $("reg-email").value.trim();
  const password = $("reg-password").value;
  const phone = $("reg-phone").value.trim();
  const college = $("reg-college").value.trim();
  const relationship = $("reg-relationship").value;
  const relatedName = $("reg-related-name").value.trim();

  if (password.length < 8) {
    setMessage(authMessage, "Password must be at least 8 characters.", true);
    return;
  }

  setMessage(authMessage, "Creating your account...");

  const { data, error } = await supabaseClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        phone_number: phone,
        college_name: college,
        relationship_label: relationship,
        related_person_name: relatedName
      }
    }
  });

  if (error) {
    setMessage(authMessage, error.message, true);
    return;
  }

  if (data.session && data.user) {
    currentUser = data.user;

    const saved = await saveProfile({
      full_name: fullName,
      phone_number: phone,
      college_name: college,
      relationship_label: relationship,
      related_person_name: relatedName
    });

    if (!saved) {
      setMessage(
        authMessage,
        "Account created, but profile saving failed. Check the profiles table and policies.",
        true
      );
      return;
    }

    await startApp(data.user);
  } else {
    $("register-form").reset();
    $("login-email").value = email;
    setMessage(
      authMessage,
      "Registration received! Check your email for the confirmation link. Confirm it, then log in here."
    );
  }
});

// ---------- LOGIN ----------

$("login-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const email = $("login-email").value.trim();
  const password = $("login-password").value;

  setMessage(authMessage, "Logging in...");

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    setMessage(authMessage, error.message, true);
    return;
  }

  await startApp(data.user);
});

// ---------- FORGOT PASSWORD ----------

$("forgot-button").addEventListener("click", async () => {
  const email = $("login-email").value.trim();

  if (!email) {
    setMessage(authMessage, "Enter your email address first.", true);
    $("login-email").focus();
    return;
  }

  setMessage(authMessage, "Sending password reset email...");

  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: "http://127.0.0.1:5500/"
  });

  if (error) {
    setMessage(authMessage, error.message, true);
    return;
  }

  setMessage(
    authMessage,
    "If this email is registered, a password reset link will be sent. Check your inbox."
  );
});

// ---------- SET NEW PASSWORD ----------

$("reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const password = $("new-password").value;
  const confirmPassword = $("confirm-password").value;

  if (password.length < 8) {
    setMessage($("reset-message"), "Use at least 8 characters.", true);
    return;
  }

  if (password !== confirmPassword) {
    setMessage($("reset-message"), "The passwords do not match.", true);
    return;
  }

  setMessage($("reset-message"), "Updating password...");

  const { error } = await supabaseClient.auth.updateUser({ password });

  if (error) {
    setMessage($("reset-message"), error.message, true);
    return;
  }

  await supabaseClient.auth.signOut();

  isPasswordRecovery = false;
  window.history.replaceState({}, document.title, window.location.pathname);

  showLoginScreen("Password updated. Please log in with your new password.");
});

supabaseClient.auth.onAuthStateChange((event) => {
  if (event === "PASSWORD_RECOVERY") {
    isPasswordRecovery = true;
    showResetScreen("Enter your new password below.");
  }
});

// ---------- PROFILE STORAGE ----------

async function saveProfile(details) {
  if (!currentUser) return false;

  const row = {
    id: currentUser.id,
    full_name: details.full_name || "",
    phone_number: details.phone_number || null,
    college_name: details.college_name || "",
    relationship_label: details.relationship_label || "Son of",
    related_person_name: details.related_person_name || ""
  };

  const { error } = await supabaseClient
    .from("profiles")
    .upsert(row, { onConflict: "id" });

  if (error) {
    console.error("Profile save failed:", error.message);
    return false;
  }

  return true;
}

async function loadProfile() {
  if (!currentUser) return null;

  const { data, error } = await supabaseClient
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .maybeSingle();

  if (error) {
    console.error("Profile load failed:", error.message);
    return null;
  }

  return data;
}

async function populateProfile() {
  const metadata = currentUser?.user_metadata || {};
  let profile = await loadProfile();

  if (!profile && currentUser) {
    const initial = {
      full_name: metadata.full_name || "",
      phone_number: metadata.phone_number || "",
      college_name: metadata.college_name || "",
      relationship_label: metadata.relationship_label || "Son of",
      related_person_name: metadata.related_person_name || ""
    };

    await saveProfile(initial);
    profile = await loadProfile();
  }

  $("profile-name").value = profile?.full_name || metadata.full_name || "";
  $("profile-email").value = currentUser?.email || "";
  $("profile-phone").value =
    profile?.phone_number || metadata.phone_number || "";
  $("profile-college").value =
    profile?.college_name || metadata.college_name || "";
  $("profile-relationship").value =
    profile?.relationship_label || metadata.relationship_label || "Son of";
  $("profile-related-name").value =
    profile?.related_person_name || metadata.related_person_name || "";
}

$("profile-button").addEventListener("click", async () => {
  $("profile-modal").classList.remove("hidden");
  setMessage(profileMessage, "Loading profile...");
  await populateProfile();
  setMessage(profileMessage, "");
});

$("close-profile").addEventListener("click", () => {
  $("profile-modal").classList.add("hidden");
});

$("profile-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  const details = {
    full_name: $("profile-name").value.trim(),
    phone_number: $("profile-phone").value.trim(),
    college_name: $("profile-college").value.trim(),
    relationship_label: $("profile-relationship").value,
    related_person_name: $("profile-related-name").value.trim()
  };

  setMessage(profileMessage, "Saving profile...");

  const saved = await saveProfile(details);

  if (!saved) {
    setMessage(
      profileMessage,
      "Profile could not be saved. Check your Supabase table and policies.",
      true
    );
    return;
  }

  const { error } = await supabaseClient.auth.updateUser({
    data: { full_name: details.full_name }
  });

  if (error) {
    setMessage(profileMessage, "Profile saved, but auth name update failed.", true);
  } else {
    setMessage(profileMessage, "Profile saved successfully!");
  }
});

// ---------- HELP CENTER ----------

const helpModal = $("help-center-modal");
const helpMessage = $("help-center-message");

$("help-center-button").addEventListener("click", async () => {
  if (!currentUser) return;

  helpModal.classList.remove("hidden");
  setMessage(helpMessage, "Loading your support requests...");
  await loadHelpRequests();
});

$("close-help-center").addEventListener("click", () => {
  helpModal.classList.add("hidden");
});

$("refresh-help-requests").addEventListener("click", loadHelpRequests);

$("help-request-form").addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setMessage(helpMessage, "Please log in to submit a request.", true);
    return;
  }

  const category = $("help-category").value;
  const message = $("help-message").value.trim();

  if (!category || !message) {
    setMessage(helpMessage, "Choose a topic and describe your issue.", true);
    return;
  }

  const submitButton = $("submit-help-request");
  submitButton.disabled = true;
  setMessage(helpMessage, "Submitting your request...");

  const { error } = await supabaseClient.from("help_requests").insert({
    user_id: currentUser.id,
    email: currentUser.email,
    category,
    message
  });

  submitButton.disabled = false;

  if (error) {
    console.error("Help request submit failed:", error.message);
    setMessage(helpMessage, "Could not submit request: " + error.message, true);
    return;
  }

  $("help-request-form").reset();
  setMessage(helpMessage, "Support request submitted successfully!");
  await loadHelpRequests();
});

async function loadHelpRequests() {
  const list = $("help-requests-list");

  if (!currentUser) {
    list.replaceChildren();
    return;
  }

  list.textContent = "Loading...";

  const { data, error } = await supabaseClient
    .from("help_requests")
    .select("id, category, message, status, admin_reply, created_at")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false });

  if (error) {
    console.error("Help requests load failed:", error.message);
    list.textContent =
      "Could not load requests: " + error.message +
      ". Check the help_requests table and its SELECT policy.";
    return;
  }

  list.replaceChildren();

  if (!data || data.length === 0) {
    const empty = document.createElement("p");
    empty.className = "muted";
    empty.textContent = "You have not submitted any requests yet.";
    list.appendChild(empty);
    return;
  }

  data.forEach((request) => {
    const card = document.createElement("article");
    card.className = "help-request";

    const title = document.createElement("h3");
    title.textContent = request.category;
    card.appendChild(title);

    const status = document.createElement("span");
    status.className = "help-status";
    status.textContent = "Status: " + (request.status || "Pending");
    card.appendChild(status);

    const date = document.createElement("p");
    date.className = "muted";
    date.textContent = request.created_at
      ? "Submitted: " + new Date(request.created_at).toLocaleString()
      : "";
    card.appendChild(date);

    const messageTitle = document.createElement("strong");
    messageTitle.textContent = "Your message";
    card.appendChild(messageTitle);

    const messageText = document.createElement("p");
    messageText.textContent = request.message;
    card.appendChild(messageText);

    const replyTitle = document.createElement("strong");
    replyTitle.textContent = "Support reply";
    card.appendChild(replyTitle);

    const replyText = document.createElement("p");
    replyText.textContent =
      request.admin_reply || "No reply yet. Please check again later.";
    card.appendChild(replyText);

    list.appendChild(card);
  });
}

// ---------- CLOUD PROGRESS ----------

async function loadProgress() {
  progress = {
    c: { completed_levels: [], xp: 0 },
    python: { completed_levels: [], xp: 0 },
    web: { completed_levels: [], xp: 0 }
  };

  const { data, error } = await supabaseClient
    .from("student_progress")
    .select("course_id, completed_levels, xp")
    .eq("user_id", currentUser.id);

  if (error) {
    console.error("Progress load failed:", error.message);
    setMessage($("app-message"), "Progress load error: " + error.message, true);
    return;
  }

  (data || []).forEach((row) => {
    if (progress[row.course_id]) {
      progress[row.course_id] = {
        completed_levels: Array.isArray(row.completed_levels)
          ? row.completed_levels
          : [],
        xp: Number(row.xp) || 0
      };
    }
  });
}

async function saveProgress(courseId) {
  const item = progress[courseId];

  const { error } = await supabaseClient
    .from("student_progress")
    .upsert({
      user_id: currentUser.id,
      course_id: courseId,
      completed_levels: item.completed_levels,
      xp: item.xp,
      updated_at: new Date().toISOString()
    }, { onConflict: "user_id,course_id" });

  if (error) {
    console.error("Progress save failed:", error.message);
    return error;
  }

  return null;
}

// ---------- APP START / LOGOUT ----------

async function startApp(user) {
  currentUser = user;
  showAppScreen();
  setMessage($("app-message"), "Loading your account...");

  await populateProfile();
  await loadProgress();
  renderLevels();
  updateDashboard();

  setMessage($("app-message"), "Welcome to CodeQuest 100!");
}

$("logout-button").addEventListener("click", async () => {
  const { error } = await supabaseClient.auth.signOut();

  if (error) {
    setMessage($("app-message"), "Logout failed: " + error.message, true);
    return;
  }

  currentUser = null;
  showLoginScreen("You have logged out.");
});

// ---------- COURSE / DIFFICULTY PICKERS ----------

document.querySelectorAll(".course-card").forEach((button) => {
  button.addEventListener("click", () => {
    currentCourse = button.dataset.course;

    document.querySelectorAll(".course-card").forEach((card) => {
      card.classList.toggle("active", card === button);
    });

    $("course-badge").textContent = courses[currentCourse];
    renderLevels();
    updateDashboard();
  });
});

document.querySelectorAll(".difficulty-card").forEach((button) => {
  button.addEventListener("click", () => {
    currentDifficulty = button.dataset.difficulty;

    document.querySelectorAll(".difficulty-card").forEach((card) => {
      card.classList.toggle("active", card === button);
    });

    renderLevels();
  });
});

// ---------- LESSON CONTENT ----------

const topicSets = {
  c: [
    ["Variables", "Variables store values.", "int score = 10;", "int", "Declare an integer variable.", "Use the int keyword."],
    ["Output", "printf() displays text or values.", 'printf("Hello, CodeQuest!");', "printf", "Use printf() to display a message.", "Start with printf."],
    ["Data Types", "C has types such as int, float and char.", "float price = 12.5;", "float", "Declare a floating-point variable.", "Use the float keyword."],
    ["Conditions", "if runs a block when a condition is true.", "if (score > 0) { printf(\"Yes\"); }", "if", "Write an if condition.", "Use the if keyword."],
    ["For Loops", "A for loop repeats a block.", "for (int i = 0; i < 5; i++) { printf(\"Hi\"); }", "for", "Create a for loop.", "Use the for keyword."],
    ["While Loops", "A while loop repeats while a condition is true.", "while (count < 5) { count++; }", "while", "Create a while loop.", "Use the while keyword."],
    ["Arrays", "An array stores multiple values of one type.", "int numbers[3] = {1, 2, 3};", "numbers", "Declare an array named numbers.", "Use the name numbers."],
    ["Functions", "Functions group reusable code.", "int add(int a, int b) { return a + b; }", "add", "Write a function named add.", "Use the function name add."],
    ["Input", "scanf() can read values from input.", "scanf(\"%d\", &score);", "scanf", "Use scanf() to read an integer.", "Start with scanf."],
    ["Strings", "A C string is a character array ending with a null character.", "char name[] = \"Quest\";", "char", "Declare a character array.", "Use the char keyword."]
  ],

  python: [
    ["Variables", "Variables hold values.", "score = 10", "score", "Create a variable called score.", "Use the name score."],
    ["Output", "print() displays information.", 'print("Hello, CodeQuest!")', "print", "Display a message with print().", "Use print()."],
    ["Data Types", "Python supports int, float, str and bool.", "price = 12.5", "price", "Create a price variable.", "Use the name price."],
    ["Conditions", "if runs when a condition is true.", "if score > 0:\n    print(\"Yes\")", "if", "Write an if statement.", "Start with if."],
    ["For Loops", "for repeats over a sequence.", "for i in range(5):\n    print(i)", "for", "Create a for loop.", "Use for and range."],
    ["While Loops", "while repeats while its condition is true.", "while count < 5:\n    count += 1", "while", "Create a while loop.", "Start with while."],
    ["Lists", "Lists store multiple values.", "numbers = [1, 2, 3]", "numbers", "Create a list named numbers.", "Use square brackets."],
    ["Functions", "def creates a function.", "def add(a, b):\n    return a + b", "def", "Define a function.", "Start with def."],
    ["Input", "input() reads text entered by a user.", "name = input(\"Name: \")", "input", "Read user input.", "Use input()."],
    ["Strings", "Strings store text.", 'name = "Quest"', "name", "Create a string variable.", "Use a variable named name."]
  ],

  web: [
    ["HTML Headings", "HTML structures webpage content. h1 is a main heading.", "<h1>Hello, CodeQuest!</h1>", "<h1", "Create an h1 heading saying Hello, CodeQuest!", "Use the h1 tag."],
    ["Paragraphs", "The p element creates a paragraph.", "<p>Welcome to coding.</p>", "<p", "Create a paragraph.", "Use the p tag."],
    ["Links", "The a element creates a link.", '<a href="https://example.com">Visit</a>', "<a", "Create an anchor element.", "Use the a tag."],
    ["Images", "The img element displays an image.", '<img src="photo.jpg" alt="Photo">', "<img", "Create an image element.", "Use the img tag."],
    ["CSS Colors", "CSS controls how elements look.", "p { color: blue; }", "color", "Set a text color with CSS.", "Use the color property."],
    ["CSS Classes", "A class selector starts with a dot.", ".card { padding: 10px; }", ".card", "Create a .card selector.", "Start the selector with .card."],
    ["JavaScript Variables", "const declares a variable that cannot be reassigned.", "const score = 10;", "const", "Declare a variable using const.", "Use const."],
    ["JavaScript Output", "console.log() writes to the developer console.", 'console.log("Hello");', "console.log", "Display a message with console.log().", "Use console.log()."],
    ["JavaScript Conditions", "if runs when a condition is true.", "if (score > 0) { console.log(score); }", "if", "Write an if statement.", "Use the if keyword."],
    ["JavaScript Functions", "function defines a reusable block of code.", "function greet() { return \"Hello\"; }", "function", "Create a function.", "Start with function."]
  ]
};

function getLesson(course, level) {
  if (course === "web" && level === 1) {
    return {
      title: "Your First Webpage",
      explanation: "HTML describes webpage content. The h1 element creates a main heading.",
      example: "<!DOCTYPE html>\n<html>\n<body>\n  <h1>Hello, CodeQuest!</h1>\n</body>\n</html>",
      mission: 'Create an h1 heading with the text "Hello, CodeQuest!" inside the body.',
      hint: "Write <h1>Hello, CodeQuest!</h1> between the body tags.",
      key: "<h1",
      exact: "hello, codequest!"
    };
  }

  if (course === "c" && level === 1) {
    return {
      title: "Your First C Program",
      explanation: "A C program can use main() as its entry point. printf() displays output.",
      example: '#include <stdio.h>\n\nint main(void) {\n    printf("Hello, CodeQuest!");\n    return 0;\n}',
      mission: 'Write a printf statement that displays "Hello, CodeQuest!".',
      hint: 'Use printf("Hello, CodeQuest!");',
      key: "printf",
      exact: "hello, codequest!"
    };
  }

  if (course === "python" && level === 1) {
    return {
      title: "Your First Python Program",
      explanation: "The print() function displays information.",
      example: 'print("Hello, CodeQuest!")',
      mission: 'Write code that displays "Hello, CodeQuest!" using print().',
      hint: 'Use print("Hello, CodeQuest!")',
      key: "print",
      exact: "hello, codequest!"
    };
  }

  const topics = topicSets[course];
  const topic = topics[(level - 1) % topics.length];
  const stage = level <= 30 ? "Beginner" : level <= 70 ? "Medium" : "Hard";

  return {
    title: topic[0] + " — Level " + level,
    explanation: topic[1] + " This is a " + stage.toLowerCase() + " practice level.",
    example: topic[2],
    mission: topic[4],
    hint: topic[5],
    key: topic[3],
    exact: null
  };
}

// ---------- LEVEL UNLOCKING ----------

function isUnlocked(course, level) {
  if (level === 1) return true;
  return progress[course].completed_levels.includes(level - 1);
}

function renderLevels() {
  const grid = $("level-grid");
  grid.replaceChildren();

  const [start, end] = difficultyRanges[currentDifficulty];

  $("levels-title").textContent =
    currentDifficulty[0].toUpperCase() +
    currentDifficulty.slice(1) +
    " Levels (" + start + "–" + end + ")";

  $("levels-description").textContent =
    "Complete levels in order to unlock the next level. Green levels are completed.";

  for (let level = start; level <= end; level++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "level";
    button.textContent = String(level);

    const done = progress[currentCourse].completed_levels.includes(level);
    const unlocked = isUnlocked(currentCourse, level);

    if (done) {
      button.classList.add("done");
      button.textContent = "✓ " + level;
      button.title = "Completed";
    } else if (unlocked) {
      button.classList.add("current");
      button.title = "Open level " + level;
    } else {
      button.classList.add("locked");
      button.textContent = "🔒";
      button.title = "Complete the previous level first";
      button.disabled = true;
    }

    button.addEventListener("click", () => openLesson(level));
    grid.appendChild(button);
  }
}

// ---------- LESSON MODAL / HINTS / CHECKING ----------

function openLesson(level) {
  if (!isUnlocked(currentCourse, level)) {
    setMessage(
      $("app-message"),
      "Complete the previous level to unlock this one.",
      true
    );
    return;
  }

  currentLevel = level;
  answerPassed = false;

  const lesson = getLesson(currentCourse, currentLevel);
  const stage = level <= 30 ? "Beginner" : level <= 70 ? "Medium" : "Hard";

  $("lesson-title").textContent = "Level " + level + ": " + lesson.title;
  $("lesson-difficulty").textContent = stage;
  $("lesson-explanation").textContent = lesson.explanation;
  $("lesson-example").textContent = lesson.example;
  $("lesson-mission").textContent = lesson.mission;
  $("hint-box").textContent = lesson.hint;
  $("hint-box").classList.add("hidden");
  $("answer-editor").value = "";
  $("complete-lesson").classList.add("hidden");
  $("check-answer").classList.remove("hidden");

  setMessage(lessonMessage, "");
  $("lesson-modal").classList.remove("hidden");
}

$("close-lesson").addEventListener("click", () => {
  $("lesson-modal").classList.add("hidden");
});

$("show-hint").addEventListener("click", () => {
  $("hint-box").classList.toggle("hidden");
});

$("show-solution").addEventListener("click", () => {
  $("answer-editor").value = getLesson(currentCourse, currentLevel).example;
});

$("check-answer").addEventListener("click", () => {
  const lesson = getLesson(currentCourse, currentLevel);
  const answer = $("answer-editor").value.trim().toLowerCase();

  if (!answer) {
    setMessage(lessonMessage, "Write your answer first, then check it.", true);
    return;
  }

  const hasKey = answer.includes(lesson.key.toLowerCase());
  const hasRequiredText = lesson.exact
    ? answer.includes(lesson.exact)
    : true;

  if (hasKey && hasRequiredText) {
    answerPassed = true;
    setMessage(lessonMessage, "Correct! You can complete this level now.");
    $("complete-lesson").classList.remove("hidden");
  } else {
    answerPassed = false;
    $("complete-lesson").classList.add("hidden");

    setMessage(
      lessonMessage,
      "Not quite yet. Check the mission and hint, then try again.",
      true
    );
  }
});

// ---------- COMPLETE LEVEL AND EARN XP ----------

$("complete-lesson").addEventListener("click", async () => {
  if (!currentUser || !answerPassed) return;

  const item = progress[currentCourse];

  if (item.completed_levels.includes(currentLevel)) {
    setMessage(lessonMessage, "This level is already completed.");
    return;
  }

  item.completed_levels.push(currentLevel);
  item.completed_levels.sort((a, b) => a - b);
  item.xp += 100;

  setMessage(lessonMessage, "Saving your progress...");

  const error = await saveProgress(currentCourse);

  if (error) {
    item.completed_levels = item.completed_levels.filter(
      (n) => n !== currentLevel
    );
    item.xp = Math.max(0, item.xp - 100);

    setMessage(lessonMessage, "Save failed: " + error.message, true);
    return;
  }

  renderLevels();
  updateDashboard();

  setMessage(lessonMessage, "Level completed! +100 XP saved to your account.");
  $("complete-lesson").classList.add("hidden");
  $("check-answer").classList.add("hidden");
  setMessage($("app-message"), "Progress saved successfully!");
});

// ---------- XP, RANK, PROGRESS ----------

function updateDashboard() {
  let totalXP = 0;
  let totalCompleted = 0;

  Object.values(progress).forEach((item) => {
    totalXP += item.xp;
    totalCompleted += item.completed_levels.length;
  });

  let rank = "Rookie Coder";
  if (totalXP >= 500) rank = "Code Explorer";
  if (totalXP >= 1500) rank = "Code Warrior";
  if (totalXP >= 3000) rank = "Master Coder";
  if (totalXP >= 6000) rank = "Code Legend";

  $("total-xp").textContent = totalXP;
  $("header-xp").textContent = totalXP;
  $("completed-count").textContent = totalCompleted + " / 300";
  $("rank-name").textContent = rank;
  $("overall-progress").style.width = (totalCompleted / 300 * 100) + "%";
}

// ---------- RESTORE SESSION ----------

async function initializeApp() {
  const hash = window.location.hash;
  const searchParams = new URLSearchParams(window.location.search);

  if (hash.includes("type=recovery") || searchParams.has("code")) {
    isPasswordRecovery = true;
    showResetScreen("Enter your new password below.");
  }

  const { data, error } = await supabaseClient.auth.getSession();

  if (error) {
    if (isPasswordRecovery) {
      showResetScreen(
        "The recovery link could not be verified. Please open a fresh reset email link."
      );
    } else {
      showLoginScreen("Could not check login status: " + error.message);
    }
    return;
  }

  if (isPasswordRecovery) {
    showResetScreen("Enter your new password below.");
    return;
  }

  if (data.session?.user) {
    await startApp(data.session.user);
  } else {
    showLoginScreen();
  }
}

initializeApp();
