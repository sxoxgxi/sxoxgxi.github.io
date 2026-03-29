const form = document.getElementById("guestbookForm");
const messagesContainer = document.getElementById("messages");
const submitBtn = document.getElementById("submitBtn");
const btnText = document.getElementById("btnText");

const WORKER_URL = "https://syncroom.sxoxgxi.workers.dev/guestbook";

async function fetchMessages() {
  try {
    const res = await fetch(WORKER_URL);
    const data = await res.json();
    renderMessages(data.messages || []);
  } catch (err) {
    console.error("Failed to fetch messages:", err);
  }
}

function timeAgo(timestamp) {
  const diff = Date.now() - new Date(timestamp).getTime();
  const mins = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days = Math.floor(diff / 86_400_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  return `${days}d ago`;
}

function renderMessages(messages) {
  if (messages.length === 0) {
    messagesContainer.innerHTML = `<p class="text-center text-[var(--muted)] text-sm">No messages yet. Be the first!</p>`;
    return;
  }
  messagesContainer.innerHTML = messages
    .map(
      (msg) => `
      <div class="message-card bg-[var(--surface)] border border-[var(--overlay)] rounded-xl p-6">
        <div class="flex justify-between items-start">
          <div class="font-medium text-[var(--foam)]">${msg.name}</div>
          <div class="text-xs text-[var(--muted)]">${timeAgo(msg.timestamp)}</div>
        </div>
        <p class="mt-3 text-[var(--text)] leading-relaxed">${msg.message}</p>
      </div>
    `,
    )
    .join("");
}

const messageInput = document.getElementById("message");
const charCount = document.getElementById("charCount");
messageInput.addEventListener("input", () => {
  charCount.textContent = `${messageInput.value.length} / 500`;
});

form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const message = document.getElementById("message").value.trim();

  if (!name || !message) return;

  submitBtn.disabled = true;
  btnText.textContent = "Sending...";

  try {
    const res = await fetch(WORKER_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name,
        message,
        website: document.getElementById("website").value,
      }),
    });

    const data = await res.json();

    if (res.ok && data.success) {
      form.reset();
      btnText.textContent = "Message sent!";
      await fetchMessages();
      setTimeout(() => {
        btnText.textContent = "Send message";
        submitBtn.disabled = false;
      }, 2500);
    } else if (res.status === 429) {
      btnText.textContent = "Too many messages, slow down!";
      setTimeout(() => {
        btnText.textContent = "Send message";
        submitBtn.disabled = false;
      }, 3000);
    } else {
      throw new Error(data.error || "Failed to send");
    }
  } catch (err) {
    btnText.textContent = "Failed, try again";
    console.error(err);
    setTimeout(() => {
      btnText.textContent = "Send message";
      submitBtn.disabled = false;
    }, 3000);
  }
});

fetchMessages();
