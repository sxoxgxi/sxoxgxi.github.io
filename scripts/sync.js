// Configuration
const CONFIG = {
  WEBSOCKET_URL: "wss://syncroom.sxoxgxi.workers.dev/ws",
  BASE_URL: "https://syncroom.sxoxgxi.workers.dev",
  UPDATE_INTERVALS: {
    ELAPSED_TIME: 1000,
    LYRICS_SYNC: 500,
  },
  MAX_RECONNECT_DELAY: 300 * 1000,
  DOM_IDS: {
    STATUS_BADGE: "status-badge",
    ACTIVITIES_CONTAINER: "activities-container",
    PRESENCE_SECTION: "presence-section",
    ACTIVITIES_LIST: "activities-list",
    PLATFORM_INFO: "platform-info",
  },
  CLASSES: {
    HIDDEN: "hidden",
    ACTIVITY_CARD:
      "activity-card bg-[var(--overlay)] p-4 rounded-lg flex flex-col space-y-3",
  },
};

// Logger utility
const Logger = {
  debug: (msg, ...args) => console.debug(msg, ...args),
  info: console.info.bind(console),
  error: console.error.bind(console),
};

// States
let websocket = null;
let retryDelay = 5000;
let intervals = [];
let currentLyrics = null;
let lastTrackId = null;
let currentSpotifyActivity = null;
let isWebSocketConnected = false;
let hasOfflineDataLoaded = false;

const sanitizeText = (() => {
  const div = document.createElement("div");
  return (text) => {
    if (!text) return "";
    div.textContent = text;
    return div.innerHTML;
  };
})();

function debounce(func, wait) {
  let timeout;
  return (...args) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

document.addEventListener("DOMContentLoaded", () => {
  initializeWebSocket();
});

function initializeWebSocket() {
  loadOfflineData().finally(() => {
    WebSocketManager.connect();
  });

  window.addEventListener("beforeunload", () => {
    intervals.forEach((interval) => clearInterval(interval.id));
    if (websocket) {
      websocket.close(1000, "Page unloading");
    }
  });
}

const WebSocketManager = {
  connect() {
    if (websocket && websocket.readyState === WebSocket.CONNECTING) {
      Logger.info("WebSocket already connecting");
      return;
    }

    websocket = new WebSocket(CONFIG.WEBSOCKET_URL);

    websocket.onopen = () => {
      Logger.info("WebSocket connected");
      isWebSocketConnected = true;
      retryDelay = 5000;
      showLoadingState();
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (!data || typeof data !== "object") {
          throw new Error("Invalid WebSocket data");
        }
        if (data.type === "ping" && websocket.readyState === WebSocket.OPEN) {
          websocket.send(JSON.stringify({ type: "pong" }));
          return;
        }
        if (data.success !== false) {
          updateUIWithData(data);
          hideLoadingState();
        } else {
          throw new Error(data.error || "Unknown WebSocket error");
        }
      } catch (error) {
        Logger.error("Error parsing WebSocket message:", error);
        showErrorState();
      }
    };

    websocket.onclose = () => {
      isWebSocketConnected = false;
      intervals.forEach((interval) => clearInterval(interval.id));
      intervals = [];
      Logger.info(
        "WebSocket disconnected, retrying in",
        retryDelay / 1000,
        "seconds",
      );
      showErrorState();
      retryDelay = Math.min(retryDelay * 1.5, CONFIG.MAX_RECONNECT_DELAY);
      const jitter = retryDelay * (0.9 + Math.random() * 0.2);
      setTimeout(() => this.connect(), jitter);
    };

    websocket.onerror = (error) => {
      Logger.error("WebSocket error:", error);
      isWebSocketConnected = false;
      showErrorState();
    };
  },
};

function formatElapsedTime(
  startTimestamp,
  isOffline = false,
  endTimestamp = null,
) {
  const now = Date.now();
  let elapsed;

  if (isOffline && endTimestamp) {
    elapsed = now - endTimestamp;
  } else {
    elapsed = now - startTimestamp;
  }

  const seconds = Math.floor(elapsed / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  } else if (hours > 0) {
    return `${hours}h ${minutes % 60}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${seconds}s`;
  }
}

function showLoadingState() {
  const statusBadge = document.getElementById(CONFIG.DOM_IDS.STATUS_BADGE);
  if (statusBadge) {
    statusBadge.style.backgroundColor = "var(--text)";
    statusBadge.style.opacity = "0.5";
    statusBadge.setAttribute("title", "Connecting to Sync Server...");
  }
}

function hideLoadingState() {
  const statusBadge = document.getElementById(CONFIG.DOM_IDS.STATUS_BADGE);
  if (statusBadge) {
    statusBadge.style.opacity = "1";
  }
}

function showErrorState() {
  intervals.forEach((interval) => clearInterval(interval.id));
  intervals = [];
  const statusBadge = document.getElementById(CONFIG.DOM_IDS.STATUS_BADGE);
  if (statusBadge && !hasOfflineDataLoaded) {
    statusBadge.style.backgroundColor = "var(--offline)";
    statusBadge.setAttribute("title", "Unable to connect to Sync Server");
  }

  if (!hasOfflineDataLoaded) {
    const activitiesContainer = document.getElementById(
      CONFIG.DOM_IDS.ACTIVITIES_CONTAINER,
    );
    const platformInfo = document.getElementById(CONFIG.DOM_IDS.PLATFORM_INFO);

    if (activitiesContainer)
      activitiesContainer.classList.add(CONFIG.CLASSES.HIDDEN);
    if (platformInfo) platformInfo.classList.add(CONFIG.CLASSES.HIDDEN);
  }
}

function updateUIWithData(data) {
  try {
    const spotifyData = data.data?.spotify || data.spotify;
    const isOffline = data.is_offline ?? false;
    const device = data.device;

    updateStatusBadge(isOffline ? "offline" : "online");

    if (spotifyData && !isOffline) {
      const trackId = spotifyData.track_id;
      if (trackId !== lastTrackId) {
        const activityData = data.data ? data.data : data;
        updateActivitiesList([createSpotifyActivity(activityData, isOffline)]);

        if (device) {
          updatePlatformInfo(device);
        }
        lastTrackId = trackId;
        hasOfflineDataLoaded = true;
      }
    } else {
      if (spotifyData) {
        const activityData = data.data ? data.data : data;
        updateActivitiesList([createSpotifyActivity(activityData, isOffline)]);
        if (device) {
          updatePlatformInfo(device);
        }
        hasOfflineDataLoaded = true;
      } else {
        document
          .getElementById(CONFIG.DOM_IDS.PRESENCE_SECTION)
          ?.classList.add(CONFIG.CLASSES.HIDDEN);
        currentSpotifyActivity = null;
        currentLyrics = null;
        lastTrackId = null;
        hideLyrics();
        hasOfflineDataLoaded = false;
      }
    }
  } catch (error) {
    Logger.error("Error updating UI:", error);
  }
}

function updatePlatformInfo(device) {
  const platformInfoEl = document.getElementById("platform-info");

  if (!platformInfoEl || !device) return;

  platformInfoEl.classList.remove(CONFIG.CLASSES.HIDDEN);
  platformInfoEl.innerHTML = `
        <span class="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-[var(--overlay)] text-[var(--text)]" 
              role="status" 
              aria-label="Active on ${device.name}">
          ${device.type}: ${device.name}
        </span>`;
}

function loadOfflineData() {
  return fetch(`${CONFIG.BASE_URL}/cache`)
    .then((res) => {
      if (!res.ok) throw new Error(`HTTP ${res.status} — ${res.statusText}`);
      const contentType = res.headers.get("content-type") || "";
      return contentType.includes("application/json") ? res.json() : res.text();
    })
    .then((data) => {
      if (data && (data.data?.spotify || data.spotify)) {
        updateUIWithData(data);
        updateStatusBadge("offline");
        hasOfflineDataLoaded = true;
      } else {
        Logger.info("No offline Spotify data available");
      }
    })
    .catch((error) => {
      Logger.error("Error loading offline data:", error);
    });
}

function updateStatusBadge(status) {
  const statusBadge = document.getElementById(CONFIG.DOM_IDS.STATUS_BADGE);
  if (!statusBadge) {
    Logger.warn("Status badge element not found");
    return;
  }

  const statusConfig = {
    online: { color: "var(--online)", text: "Sogi is online" },
    offline: { color: "var(--offline)", text: "Sogi is offline" },
  };

  const config = statusConfig[status] || statusConfig.offline;
  statusBadge.style.backgroundColor = config.color;
  statusBadge.setAttribute("title", config.text);
  statusBadge.setAttribute("aria-label", config.text);
}

function updateActivitiesList(activities) {
  const activitiesContainer = document.getElementById(
    CONFIG.DOM_IDS.ACTIVITIES_CONTAINER,
  );
  const presenceSection = document.getElementById(
    CONFIG.DOM_IDS.PRESENCE_SECTION,
  );
  const activitiesList = document.getElementById(
    CONFIG.DOM_IDS.ACTIVITIES_LIST,
  );

  if (!activitiesList || !activitiesContainer) {
    Logger.warn("Activities list or container not found");
    return;
  }

  if (activities.length > 0) {
    activitiesContainer.classList.remove(CONFIG.CLASSES.HIDDEN);
    if (presenceSection)
      presenceSection.classList.remove(CONFIG.CLASSES.HIDDEN);

    activitiesList.innerHTML = "";

    activities.forEach((activity) => {
      const card = createActivityCard(activity);
      activitiesList.appendChild(card);
    });

    const spotifyActivity = activities.find(
      (activity) => activity.name === "Spotify",
    );
    if (spotifyActivity && spotifyActivity !== currentSpotifyActivity) {
      currentSpotifyActivity = spotifyActivity;
      if (currentSpotifyActivity.lyrics) {
        currentLyrics = currentSpotifyActivity.lyrics.synced
          ? parseSyncedLyrics(currentSpotifyActivity.lyrics.lines)
          : { plain: currentSpotifyActivity.lyrics.plain_lyrics };
        showLyrics();
        if (currentSpotifyActivity.lyrics.synced) {
          startLyricsSync();
        } else {
          showPlainLyrics(
            currentSpotifyActivity.lyrics.plain_lyrics,
            `spotify-${spotifyActivity.timestamps.start}`,
          );
        }
      }
    } else if (!spotifyActivity) {
      currentSpotifyActivity = null;
      currentLyrics = null;
      hideLyrics();
    }

    startElapsedTimeUpdates(activities[0].is_offline);
  } else {
    activitiesContainer.classList.add(CONFIG.CLASSES.HIDDEN);
    currentSpotifyActivity = null;
    currentLyrics = null;
    hideLyrics();
  }
}

function createSpotifyActivity(spotifyData, isOffline = false) {
  const spotify = spotifyData.spotify || spotifyData;
  return {
    name: "Spotify",
    is_offline: isOffline,
    details: spotify.song,
    state: spotify.artist,
    timestamps: {
      start: spotify.timestamps?.start,
      end: spotify.timestamps?.end,
    },
    assets: {
      large_image: spotify.album_art_url,
    },
    sync_id: spotify.track_id,
    lyrics: spotifyData.lyrics,
  };
}

function parseSyncedLyrics(lines) {
  return lines.map((line) => ({
    timestamp: line.time,
    text: line.text,
  }));
}

function showLyrics() {
  if (currentSpotifyActivity?.timestamps?.start) {
    const activityId = `spotify-${currentSpotifyActivity.timestamps.start}`;
    const lyricsToggle = document.getElementById(`lyrics-toggle-${activityId}`);
    if (lyricsToggle) {
      lyricsToggle.classList.remove(CONFIG.CLASSES.HIDDEN);
      lyricsToggle.setAttribute("aria-busy", "true"); // Indicate loading
      setTimeout(() => lyricsToggle.removeAttribute("aria-busy"), 500); // Simulate delay
    }
  }
}

function createLyricsContainer(activityId) {
  const container = document.createElement("div");
  container.id = `lyrics-container-${activityId}`;
  container.className = "mt-2 p-4 bg-[var(--surface)] rounded-lg hidden";
  container.setAttribute("data-expanded", "false");

  const lyricsDisplay = document.createElement("div");
  lyricsDisplay.id = `lyrics-display-${activityId}`;
  lyricsDisplay.className = "max-h-48 overflow-y-auto space-y-1";
  lyricsDisplay.setAttribute("aria-live", "polite");

  container.appendChild(lyricsDisplay);
  return container;
}

function showPlainLyrics(plainLyrics, activityId) {
  showLyrics();
  const lyricsDisplay = document.getElementById(`lyrics-display-${activityId}`);
  if (lyricsDisplay) {
    lyricsDisplay.innerHTML = `
      <div class="text-sm text-[var(--text)] opacity-70 whitespace-pre-line">
        ${sanitizeText(plainLyrics)}
      </div>
    `;
  }
}

function hideLyrics() {
  const lyricsToggles = document.querySelectorAll('[id^="lyrics-toggle-"]');
  lyricsToggles.forEach((toggle) =>
    toggle.classList.add(CONFIG.CLASSES.HIDDEN),
  );

  const lyricsContainers = document.querySelectorAll(
    '[id^="lyrics-container-"]',
  );
  lyricsContainers.forEach((container) => {
    container.classList.add(CONFIG.CLASSES.HIDDEN);
    container.setAttribute("data-expanded", "false");
  });
}

function startLyricsSync() {
  const existingLyricsInterval = intervals.find((i) => i.type === "lyrics");
  if (existingLyricsInterval) {
    clearInterval(existingLyricsInterval.id);
    intervals = intervals.filter((i) => i.type !== "lyrics");
  }

  const intervalId = setInterval(() => {
    if (currentLyrics && currentSpotifyActivity?.timestamps?.start) {
      updateLyricsDisplay();
    }
  }, CONFIG.UPDATE_INTERVALS.LYRICS_SYNC);

  intervals.push({ type: "lyrics", id: intervalId });
}

function getCurrentLyricLine() {
  if (!currentLyrics || !currentSpotifyActivity?.timestamps?.start) return null;

  const currentTime = Date.now() - currentSpotifyActivity.timestamps.start;
  let currentLine = null;

  for (let i = 0; i < currentLyrics.length; i++) {
    if (currentTime >= currentLyrics[i].timestamp) {
      currentLine = currentLyrics[i].text;
    } else {
      break;
    }
  }

  return currentLine;
}

function updateLyricsDisplay() {
  if (!currentLyrics || !currentSpotifyActivity?.timestamps?.start) return;

  const currentTime = Date.now() - currentSpotifyActivity.timestamps.start;
  const activityId = `spotify-${currentSpotifyActivity.timestamps.start}`;
  const lyricsDisplay = document.getElementById(`lyrics-display-${activityId}`);
  const lyricsToggleText = document.getElementById(
    `lyrics-toggle-text-${activityId}`,
  );

  if (!lyricsDisplay) return;

  if (currentLyrics.plain) {
    return;
  }

  let currentLineIndex = -1;
  for (let i = 0; i < currentLyrics.length; i++) {
    if (currentTime >= currentLyrics[i].timestamp) {
      currentLineIndex = i;
    } else {
      break;
    }
  }

  if (lyricsDisplay.children.length === currentLyrics.length) {
    Array.from(lyricsDisplay.children).forEach((child, index) => {
      const isActive = index === currentLineIndex;
      const isPast = index < currentLineIndex;
      const isFuture = index > currentLineIndex;

      child.className = "text-sm transition-all duration-300 py-1";
      if (isActive) {
        child.className += " text-[var(--iris)] font-semibold";
      } else if (isPast) {
        child.className += " text-[var(--text)] opacity-50";
      } else if (isFuture) {
        child.className += " text-[var(--text)] opacity-30";
      }
    });
  } else {
    const lyricsHTML = currentLyrics
      .map((line, index) => {
        const isActive = index === currentLineIndex;
        const isPast = index < currentLineIndex;
        const isFuture = index > currentLineIndex;

        let className = "text-sm transition-all duration-300 py-1";
        if (isActive) {
          className += " text-[var(--iris)] font-semibold";
        } else if (isPast) {
          className += " text-[var(--text)] opacity-50";
        } else if (isFuture) {
          className += " text-[var(--text)] opacity-30";
        }

        return `<div class="${className}">${sanitizeText(line.text)}</div>`;
      })
      .join("");
    lyricsDisplay.innerHTML = lyricsHTML;
  }

  if (lyricsToggleText) {
    const isExpanded =
      document
        .getElementById(`lyrics-container-${activityId}`)
        ?.getAttribute("data-expanded") === "true";
    const currentLyric = getCurrentLyricLine();
    lyricsToggleText.textContent = currentLyric
      ? isExpanded
        ? "Hide Lyrics"
        : currentLyric
      : isExpanded
        ? "Hide Lyrics"
        : "Show Lyrics";
  }

  if (currentLineIndex >= 0) {
    const currentLineElement = lyricsDisplay.children[currentLineIndex];
    if (currentLineElement) {
      currentLineElement.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }
}

function createActivityCard(activity) {
  const activityId =
    activity.name === "Spotify"
      ? `spotify-${activity.timestamps?.start || Date.now()}`
      : `activity-${Date.now()}`;

  const card = document.createElement("div");
  card.className = CONFIG.CLASSES.ACTIVITY_CARD;
  card.setAttribute("role", "article");
  card.setAttribute("aria-label", `Activity: ${activity.name}`);

  const mainContent = document.createElement("div");
  mainContent.className = "flex items-center space-x-3";

  const icon = createActivityIcon(activity);
  const content = createActivityContent(activity);

  mainContent.appendChild(icon);
  mainContent.appendChild(content);
  card.appendChild(mainContent);

  if (activity.name === "Spotify") {
    const lyricsToggle = createLyricsToggle(activityId);
    const lyricsContainer = createLyricsContainer(activityId);
    card.appendChild(lyricsToggle);
    card.appendChild(lyricsContainer);
  }

  return card;
}

function createLyricsToggle(activityId) {
  const toggleContainer = document.createElement("div");
  toggleContainer.id = `lyrics-toggle-${activityId}`;
  toggleContainer.className = CONFIG.CLASSES.HIDDEN;

  const toggleButton = document.createElement("button");
  toggleButton.className =
    "flex justify-center items-center text-sm font-medium text-[var(--love)] gap-1 hover:underline focus:underline focus:outline-none";
  toggleButton.innerHTML = `
    <span id="lyrics-toggle-text-${activityId}">Show Lyrics</span>
    <svg class="w-4 h-4 mr-2 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path>
    </svg>
  `;

  toggleButton.addEventListener(
    "click",
    debounce(() => {
      const lyricsContainer = document.getElementById(
        `lyrics-container-${activityId}`,
      );
      const isExpanded =
        lyricsContainer.getAttribute("data-expanded") === "true";
      const icon = toggleButton.querySelector("svg");
      const text = toggleButton.querySelector(
        `#lyrics-toggle-text-${activityId}`,
      );

      if (isExpanded) {
        lyricsContainer.classList.add(CONFIG.CLASSES.HIDDEN);
        lyricsContainer.setAttribute("data-expanded", "false");
        icon.style.transform = "rotate(0deg)";
        text.textContent =
          currentLyrics && !currentLyrics.plain
            ? getCurrentLyricLine() || "Show Lyrics"
            : "Show Lyrics";
      } else {
        lyricsContainer.classList.remove(CONFIG.CLASSES.HIDDEN);
        lyricsContainer.setAttribute("data-expanded", "true");
        icon.style.transform = "rotate(90deg)";
        text.textContent =
          currentLyrics && !currentLyrics.plain
            ? getCurrentLyricLine() || "Hide Lyrics"
            : "Hide Lyrics";
      }
    }, 200),
  );

  toggleContainer.appendChild(toggleButton);
  return toggleContainer;
}

function createActivityIcon(activity) {
  const icon = document.createElement("img");
  icon.className = "sm:size-24 size-16 rounded-lg";
  icon.style.display = "none";
  icon.setAttribute("alt", `${activity.name} icon`);

  if (activity.assets?.large_image) {
    icon.src = activity.assets.large_image;
    icon.style.display = "block";
    icon.onerror = () => {
      icon.style.display = "none";
    };
  }

  return icon;
}

function createActivityContent(activity) {
  const content = document.createElement("div");
  content.className = "flex-1";

  const name = document.createElement("div");
  name.className = "font-semibold text-md text-[var(--text)]";
  name.textContent = sanitizeText(activity.name);
  content.appendChild(name);

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

  if (activity.state) {
    const state = document.createElement("p");
    state.className = "text-sm text-[var(--foam)]";
    state.textContent = sanitizeText(activity.state);
    content.appendChild(state);
  }

  if (activity.timestamps?.start) {
    const time = document.createElement("p");
    time.className = "text-xs text-[var(--text)] opacity-60 mt-1";
    time.setAttribute("data-start", activity.timestamps.start);
    if (activity.is_offline) {
      time.textContent = `Active ${formatElapsedTime(activity.timestamps.start)} ago.`;
    }
    content.appendChild(time);
  }

  return content;
}

function startElapsedTimeUpdates(isOffline = false) {
  const existingInterval = intervals.find((i) => i.type === "elapsed");
  if (existingInterval) {
    clearInterval(existingInterval.id);
    intervals = intervals.filter((i) => i.type !== "elapsed");
  }

  let lastUpdate = 0;
  function update(timestamp) {
    if (timestamp - lastUpdate >= CONFIG.UPDATE_INTERVALS.ELAPSED_TIME) {
      document.querySelectorAll("[data-start]").forEach((el) => {
        const start = parseInt(el.getAttribute("data-start"));
        if (start && !isOffline) {
          el.textContent = `Active for ${formatElapsedTime(start)}`;
        }
      });
      lastUpdate = timestamp;
    }
    requestAnimationFrame(update);
  }

  requestAnimationFrame(update);
  intervals.push({ type: "elapsed", id: null });
}
