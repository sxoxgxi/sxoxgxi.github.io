// Configuration
const CONFIG = {
  DISCORD_USER_ID: "755703966720983050",
  UPDATE_INTERVALS: {
    DISCORD_STATUS: 120 * 1000,
    ACTIVITY_TIME: 30 * 1000,
    ELAPSED_TIME: 1 * 1000,
  },
  API_ENDPOINTS: {
    LANYARD: "https://api.lanyard.rest/v1/users/",
  },
  MAX_RETRY_DELAY: 300 * 1000,
};

// State management
let retryDelay = CONFIG.UPDATE_INTERVALS.DISCORD_STATUS;
let intervals = [];

document.addEventListener("DOMContentLoaded", () => {
  initializeDiscordIntegration();
});

function initializeDiscordIntegration() {
  getDiscordStatusWithRetry();
  startPeriodicUpdates();
  setupVisibilityHandling();
}

function formatElapsedTime(startTimestamp) {
  const now = Date.now();
  const elapsed = now - startTimestamp;
  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

function sanitizeText(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function showLoadingState() {
  const statusBadge = document.getElementById("status-badge");
  if (statusBadge) {
    statusBadge.style.backgroundColor = "var(--text)";
    statusBadge.style.opacity = "0.5";
    statusBadge.setAttribute("title", "Loading Discord status...");
  }
}

function hideLoadingState() {
  const statusBadge = document.getElementById("status-badge");
  if (statusBadge) {
    statusBadge.style.opacity = "1";
  }
}

function showErrorState() {
  const statusBadge = document.getElementById("status-badge");
  if (statusBadge) {
    statusBadge.style.backgroundColor = "var(--offline)";
    statusBadge.setAttribute("title", "Unable to load Discord status");
  }

  const activitiesContainer = document.getElementById("activities-container");
  const platformInfo = document.getElementById("platform-info");

  if (activitiesContainer) activitiesContainer.classList.add("hidden");
  if (platformInfo) platformInfo.classList.add("hidden");
}

async function getDiscordStatusWithRetry() {
  try {
    showLoadingState();
    await getDiscordStatus();
    hideLoadingState();
    retryDelay = CONFIG.UPDATE_INTERVALS.DISCORD_STATUS;
  } catch (error) {
    console.error(`Discord API error: ${error.message}`);
    showErrorState();
    retryDelay = Math.min(retryDelay * 1.5, CONFIG.MAX_RETRY_DELAY);
    console.log(`Retrying in ${retryDelay / 1000} seconds`);
  }

  setTimeout(getDiscordStatusWithRetry, retryDelay);
}

async function getDiscordStatus() {
  const response = await fetch(
    `${CONFIG.API_ENDPOINTS.LANYARD}${CONFIG.DISCORD_USER_ID}`,
    {
      headers: {
        Accept: "application/json",
      },
      signal: AbortSignal.timeout(10000),
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const result = await response.json();

  if (!result.success || !result.data) {
    throw new Error("Invalid API response format");
  }

  updateUIWithData(result.data);
}

function updateUIWithData(userData) {
  try {
    updateUserAvatar(userData);
    updateStatusBadge(userData.discord_status);
    if (userData.activities && userData.activities.length > 0) {
      updateActivitiesList(userData.activities || []);
      updatePlatformInfo(userData);
    } else {
      document.getElementById("presence-section").classList.add("hidden");
    }
    updateCustomStatus(userData.activities || []);
  } catch (error) {
    console.error("Error updating UI:", error);
  }
}

// Update user avatar
function updateUserAvatar(userData) {
  if (!userData.discord_user?.avatar) return;

  const avatarUrl = `https://cdn.discordapp.com/avatars/${userData.discord_user.id}/${userData.discord_user.avatar}.png?size=128`;
  const avatarImg = document.querySelector('img[alt*="Avatar"]');

  if (avatarImg) {
    avatarImg.src = avatarUrl;
    avatarImg.onerror = () => {
      // Fallback to GitHub avatar if Discord avatar fails
      avatarImg.src = "https://github.com/sxoxgxi.png";
    };
  }
}

// Update status badge
function updateStatusBadge(userStatus) {
  const statusBadge = document.getElementById("status-badge");
  if (!statusBadge) return;

  const statusConfig = {
    online: { color: "var(--online)", text: "SOGI is online" },
    idle: { color: "var(--idle)", text: "SOGI is idle" },
    dnd: { color: "var(--dnd)", text: "SOGI is busy" },
    offline: { color: "var(--offline)", text: "SOGI is offline" },
  };

  const config = statusConfig[userStatus] || statusConfig.offline;
  statusBadge.style.backgroundColor = config.color;
  statusBadge.setAttribute("title", config.text);
  statusBadge.setAttribute("aria-label", config.text);
}

// Update custom status
function updateCustomStatus(activities) {
  const customStatusActivity = activities.find((a) => a.type === 4);
  const customStatusElement = document.getElementById("custom-status");

  if (!customStatusElement) return;

  if (customStatusActivity?.state) {
    customStatusElement.textContent = sanitizeText(customStatusActivity.state);
    customStatusElement.classList.remove("hidden");
  } else {
    customStatusElement.classList.add("hidden");
  }
}

// Update activities list
function updateActivitiesList(activities) {
  const activitiesContainer = document.getElementById("activities-container");
  const presenceSection = document.getElementById("presence-section");
  const activitiesList = document.getElementById("activities-list");

  if (!activitiesList || !activitiesContainer) return;

  // Filter out custom status activities (type 4)
  const displayActivities = activities.filter(
    (activity) => activity.type !== 4,
  );

  if (displayActivities.length > 0) {
    activitiesContainer.classList.remove("hidden");
    if (presenceSection) presenceSection.classList.remove("hidden");

    // Clear existing activities
    activitiesList.innerHTML = "";

    // Sort activities by start time (most recent first)
    displayActivities.sort((a, b) => {
      const aTime = a.timestamps?.start || 0;
      const bTime = b.timestamps?.start || 0;
      return bTime - aTime;
    });

    displayActivities.forEach((activity) => {
      const card = createActivityCard(activity);
      activitiesList.appendChild(card);
    });

    // Start elapsed time updates
    startElapsedTimeUpdates();
  } else {
    activitiesContainer.classList.add("hidden");
  }
}

// Create activity card element
function createActivityCard(activity) {
  const card = document.createElement("div");
  card.className =
    "activity-card bg-[var(--overlay)] p-4 rounded-lg flex items-center space-x-3";
  card.setAttribute("role", "article");
  card.setAttribute("aria-label", `Activity: ${activity.name}`);

  const icon = createActivityIcon(activity);
  const content = createActivityContent(activity);

  card.appendChild(icon);
  card.appendChild(content);

  return card;
}

// Create activity icon
function createActivityIcon(activity) {
  const icon = document.createElement("img");
  icon.className = "sm:size-24 size-16 rounded-lg";
  icon.style.display = "none";
  icon.setAttribute("alt", `${activity.name} icon`);

  if (activity.assets?.large_image) {
    let iconUrl = activity.assets.large_image;

    // Handle different icon URL formats
    if (iconUrl.startsWith("mp:external/")) {
      iconUrl = iconUrl.replace(
        "mp:external/",
        "https://media.discordapp.net/external/",
      );
    } else if (iconUrl.startsWith("spotify:")) {
      iconUrl = `https://i.scdn.co/image/${iconUrl.replace("spotify:", "")}`;
    } else if (iconUrl.startsWith("mp:")) {
      iconUrl = `https://cdn.discordapp.com/app-assets/${activity.application_id}/${iconUrl.replace("mp:", "")}.png`;
    }

    icon.src = iconUrl;
    icon.style.display = "block";
    icon.onerror = () => {
      icon.style.display = "none";
    };
  }

  return icon;
}

// Create activity content
function createActivityContent(activity) {
  const content = document.createElement("div");
  content.className = "flex-1";

  // Activity name
  const name = document.createElement("div");
  name.className = "font-semibold text-md text-[var(--text)]";
  name.textContent = sanitizeText(activity.name);
  content.appendChild(name);

  // Activity details (for Spotify, make it a link)
  if (activity.name === "Spotify" && activity.sync_id) {
    const trackLink = document.createElement("a");
    trackLink.href = `https://open.spotify.com/track/${activity.sync_id}`;
    trackLink.target = "_blank";
    trackLink.rel = "noopener noreferrer";
    trackLink.className =
      "text-sm font-medium text-[var(--iris)] hover:underline focus:underline focus:outline-none";
    trackLink.textContent =
      sanitizeText(activity.details) || "Listen on Spotify";
    trackLink.setAttribute(
      "aria-label",
      `Listen to ${activity.details} on Spotify`,
    );
    content.appendChild(trackLink);
  } else if (activity.details) {
    const details = document.createElement("p");
    details.className = "text-sm text-[var(--iris)]";
    details.textContent = sanitizeText(activity.details);
    content.appendChild(details);
  }

  // Activity state
  if (activity.state) {
    const state = document.createElement("p");
    state.className = "text-sm text-[var(--foam)]";
    state.textContent = sanitizeText(activity.state);
    content.appendChild(state);
  }

  // Activity time
  if (activity.timestamps?.start) {
    const time = document.createElement("p");
    time.className = "text-xs text-[var(--text)] opacity-60 mt-1";
    time.setAttribute("data-start", activity.timestamps.start);
    time.textContent = `Active for ${formatElapsedTime(activity.timestamps.start)}`;
    content.appendChild(time);
  }

  return content;
}

// Update platform information
function updatePlatformInfo(userData) {
  const platformInfoEl = document.getElementById("platform-info");
  const platformBadgesEl = document.getElementById("platform-badges");

  if (!platformInfoEl || !platformBadgesEl) return;

  const platforms = [];
  if (userData.active_on_discord_desktop)
    platforms.push({ name: "Desktop", icon: "🖥️" });
  if (userData.active_on_discord_web)
    platforms.push({ name: "Web", icon: "🌐" });
  if (userData.active_on_discord_mobile)
    platforms.push({ name: "Mobile", icon: "📱" });

  if (platforms.length > 0) {
    platformBadgesEl.innerHTML = platforms
      .map(
        (p) => `
        <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-[var(--overlay)] text-[var(--text)]" 
              role="status" 
              aria-label="Active on ${p.name}">
          ${p.icon} ${p.name}
        </span>
      `,
      )
      .join("");
    platformInfoEl.classList.remove("hidden");
  } else {
    platformInfoEl.classList.add("hidden");
  }
}

// Start elapsed time updates
function startElapsedTimeUpdates() {
  // Clear existing interval to prevent duplicates
  const existingInterval = intervals.find((i) => i.type === "elapsed");
  if (existingInterval) {
    clearInterval(existingInterval.id);
    intervals = intervals.filter((i) => i.type !== "elapsed");
  }

  const intervalId = setInterval(() => {
    document.querySelectorAll("[data-start]").forEach((el) => {
      const start = parseInt(el.getAttribute("data-start"));
      if (start) {
        el.textContent = `Active for ${formatElapsedTime(start)}`;
      }
    });
  }, CONFIG.UPDATE_INTERVALS.ELAPSED_TIME);

  intervals.push({ type: "elapsed", id: intervalId });
}

// Start periodic updates
function startPeriodicUpdates() {
  // Activity time update interval
  const activityUpdateId = setInterval(() => {
    const activityTimeEl = document.getElementById("activity-time");
    const startTime = window.currentActivityStart;

    if (startTime && activityTimeEl) {
      activityTimeEl.textContent = `Active for ${formatElapsedTime(startTime)}`;
    }
  }, CONFIG.UPDATE_INTERVALS.ACTIVITY_TIME);

  intervals.push({ type: "activity", id: activityUpdateId });
}

// Handle page visibility changes to pause/resume updates
function setupVisibilityHandling() {
  let isVisible = !document.hidden;

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      // Page is hidden, reduce update frequency
      isVisible = false;
      console.log("Page hidden, reducing update frequency");
    } else {
      // Page is visible, resume normal updates
      isVisible = true;
      console.log("Page visible, resuming normal updates");
      // Immediately fetch fresh data when page becomes visible
      getDiscordStatusWithRetry();
    }
  });

  // Cleanup intervals when page is unloaded
  window.addEventListener("beforeunload", () => {
    intervals.forEach((interval) => clearInterval(interval.id));
  });
}
