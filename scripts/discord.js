document.addEventListener("DOMContentLoaded", () => {
  const discordUserId = "755703966720983050";

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

  function updateActivityTime() {
    const activityTimeEl = document.getElementById("activity-time");
    const startTime = window.currentActivityStart;

    if (startTime && activityTimeEl) {
      activityTimeEl.textContent = `Active for ${formatElapsedTime(startTime)}`;
    }
  }

  async function getDiscordStatus() {
    try {
      const response = await fetch(
        `https://api.lanyard.rest/v1/users/${discordUserId}`,
      );
      const result = await response.json();
      if (!result.success || !result.data) return;

      const userData = result.data;
      const userStatus = userData.discord_status;
      const userActivities = userData.activities || [];

      if (userData.discord_user && userData.discord_user.avatar) {
        const avatarUrl = `https://cdn.discordapp.com/avatars/${userData.discord_user.id}/${userData.discord_user.avatar}.png?size=128`;
        const avatarImg = document.querySelector('img[alt="SOGI\'s Avatar"]');
        if (avatarImg) avatarImg.src = avatarUrl;
      }

      const statusBadge = document.getElementById("status-badge");
      if (statusBadge) {
        statusBadge.style.backgroundColor = "var(--offline)";
        let tooltipText = "SOGI is offline";

        if (userStatus === "online") {
          statusBadge.style.backgroundColor = "var(--online)";
          tooltipText = "SOGI is online";
        } else if (userStatus === "idle") {
          statusBadge.style.backgroundColor = "var(--idle)";
          tooltipText = "SOGI is idle";
        } else if (userStatus === "dnd") {
          statusBadge.style.backgroundColor = "var(--dnd)";
          tooltipText = "SOGI is busy";
        }

        statusBadge.setAttribute("title", tooltipText);
      }

      const customStatusActivity = userActivities.find((a) => a.type === 4);
      const customStatusElement = document.getElementById("custom-status");
      if (customStatusActivity?.state && customStatusElement) {
        customStatusElement.innerText = customStatusActivity.state;
        customStatusElement.classList.remove("hidden");
      } else if (customStatusElement) {
        customStatusElement.classList.add("hidden");
      }

      const activitiesContainer = document.getElementById(
        "activities-container",
      );
      const presenceSection = document.getElementById("presence-section");
      const activitiesList = document.getElementById("activities-list");

      if (userActivities.length > 0 && activitiesContainer && activitiesList) {
        activitiesContainer.classList.remove("hidden");
        activitiesList.innerHTML = "";

        userActivities.sort((a, b) => {
          const aTime = a.timestamps?.start || 0;
          const bTime = b.timestamps?.start || 0;
          return bTime - aTime;
        });

        userActivities.forEach((activity) => {
          const card = document.createElement("div");
          card.className =
            "activity-card bg-[var(--overlay)] p-4 rounded-lg flex items-center space-x-3";

          const icon = document.createElement("img");
          icon.className = "sm:size-24 size-16 rounded-lg";
          icon.style.display = "none";

          if (activity.assets?.large_image) {
            let iconUrl = activity.assets.large_image;
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
          }

          const content = document.createElement("div");
          content.className = "flex-1";

          const name = document.createElement("div");
          name.className = "font-semibold text-md text-[var(--text)]";
          name.textContent = activity.name;

          const state = document.createElement("p");
          state.className = "text-sm text-[var(--foam)]";
          if (activity.state) {
            state.textContent = activity.state;
          }

          content.appendChild(name);
          const details = document.createElement("p");
          details.className = "text-sm text-[var(--iris)]";

          if (activity.name === "Spotify" && activity.sync_id) {
            const trackLink = document.createElement("a");
            trackLink.href = `https://open.spotify.com/track/${activity.sync_id}`;
            trackLink.target = "_blank";
            trackLink.className =
              "text-sm font-medium text-[var(--iris)] hover:underline";
            trackLink.textContent = activity.details || "Listen on Spotify";
            content.appendChild(trackLink);
          } else if (activity.details) {
            details.textContent = activity.details;
            content.appendChild(details);
          }

          const time = document.createElement("p");
          time.className = "text-xs text-[var(--text)] opacity-60 mt-1";
          if (activity.timestamps?.start) {
            const startTime = activity.timestamps.start;
            time.setAttribute("data-start", startTime);
            time.textContent = `Active for ${formatElapsedTime(startTime)}`;
          }

          if (activity.state) content.appendChild(state);
          content.appendChild(time);

          card.appendChild(icon);
          card.appendChild(content);
          activitiesList.appendChild(card);
        });
      } else {
        if (activitiesContainer) presenceSection.classList.add("hidden");
      }

      setInterval(() => {
        document.querySelectorAll("[data-start]").forEach((el) => {
          const start = parseInt(el.getAttribute("data-start"));
          el.textContent = `Active for ${formatElapsedTime(start)}`;
        });
      }, 1 * 1000);

      const platformInfoEl = document.getElementById("platform-info");
      const platformBadgesEl = document.getElementById("platform-badges");

      if (platformInfoEl && platformBadgesEl) {
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
              (p) =>
                `<span class="inline-flex items-center px-2 py-1 rounded-lg text-xs bg-[var(--overlay)] text-[var(--text)]">
                ${p.icon} ${p.name}
              </span>`,
            )
            .join("");
          platformInfoEl.classList.remove("hidden");
        } else {
          platformInfoEl.classList.add("hidden");
        }
      }
    } catch (error) {
      console.error("Failed to fetch Discord status:", error);
    }
  }

  getDiscordStatus();

  setInterval(getDiscordStatus, 60 * 1000);

  setInterval(updateActivityTime, 30 * 1000);
});
