(() => {
  "use strict";

  const canvas = document.querySelector("#heart-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const heartStage = document.querySelector("#heart-stage");
  const hitbox = document.querySelector(".heart-hitbox");
  const nameNode = document.querySelector("#recipient-name");
  const dateNode = document.querySelector("#date-stamp");
  const shareButton = document.querySelector("#share-button");
  const soundButton = document.querySelector(".sound-toggle");
  const soundLabel = document.querySelector(".sound-toggle__label");
  const toast = document.querySelector("#toast");
  const gameOverlay = document.querySelector("#game-overlay");
  const gameOpenButton = document.querySelector("#game-open");
  const gameCloseButton = document.querySelector("#game-close");
  const gameIntro = document.querySelector("#game-intro");
  const gamePlay = document.querySelector("#game-play");
  const gameResult = document.querySelector("#game-result");
  const gameStartButton = document.querySelector("#game-start");
  const gameRetryButton = document.querySelector("#game-retry");
  const gameShareButton = document.querySelector("#game-share");
  const gameArena = document.querySelector("#game-arena");
  const gameTarget = document.querySelector("#game-target");
  const gameScoreNode = document.querySelector("#game-score");
  const gameComboNode = document.querySelector("#game-combo");
  const gameTimeNode = document.querySelector("#game-time");
  const gameProgress = document.querySelector("#game-progress");
  const gameBestNode = document.querySelector("#game-best");
  const gameResultScore = document.querySelector("#game-result-score");
  const gameRank = document.querySelector("#game-rank");
  const gameResultCopy = document.querySelector("#game-result-copy");
  const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const lowPowerDevice = (navigator.deviceMemory && navigator.deviceMemory <= 4)
    || (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const targetFps = reduceMotion ? 8 : lowPowerDevice ? 24 : 30;
  const frameInterval = 1000 / targetFps;

  const url = new URL(window.location.href);
  const rawName = (url.searchParams.get("name") || "подруга").trim();
  const recipient = rawName.slice(0, 32) || "подруга";
  nameNode.textContent = recipient;
  document.title = recipient === "подруга" ? "Для кое-кого очень классного" : `${recipient}, лови персональный вайб`;

  dateNode.textContent = new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit"
  }).format(new Date());

  const state = {
    width: 0,
    height: 0,
    dpr: 1,
    stageX: 0,
    stageY: 0,
    stageSize: 500,
    pointerX: 0,
    pointerY: 0,
    targetX: 0,
    targetY: 0,
    rotationX: -0.09,
    rotationY: 0,
    targetRotationX: -0.09,
    targetRotationY: 0,
    pressing: false,
    lastTime: performance.now(),
    elapsed: 0,
    pulseKick: 0,
    particles: [],
    sparks: [],
    ambient: [],
    soundOn: false,
    audio: null,
    rafId: 0,
    resizeTimer: 0,
    gameOpen: false
  };

  const game = {
    active: false,
    score: 0,
    combo: 0,
    best: 0,
    endAt: 0,
    targetGood: true,
    spawnTimer: 0,
    tickTimer: 0
  };

  try {
    game.best = Number.parseInt(localStorage.getItem("vibe-check-best") || "0", 10) || 0;
  } catch (_) {
    game.best = 0;
  }
  gameBestNode.textContent = String(game.best).padStart(3, "0");

  const random = (min, max) => min + Math.random() * (max - min);

  function heartPoint(t, fill, depthAngle, depthScale) {
    const outlineX = 16 * Math.pow(Math.sin(t), 3);
    const outlineY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const edge = Math.pow(fill, 0.55);
    const thickness = Math.sin(Math.PI * edge) * 5.1 * depthScale;
    return {
      x: outlineX * edge,
      y: -outlineY * edge + 1.4,
      z: Math.cos(depthAngle) * thickness
    };
  }

  function buildHeart() {
    const count = lowPowerDevice || state.width < 600 ? 460 : 720;
    state.particles = [];

    for (let i = 0; i < count; i += 1) {
      const t = random(0, Math.PI * 2);
      const fill = Math.sqrt(Math.random());
      const depthAngle = random(0, Math.PI * 2);
      const point = heartPoint(t, fill, depthAngle, random(0.72, 1));
      const edgeBias = fill > 0.82;
      state.particles.push({
        ...point,
        baseX: point.x,
        baseY: point.y,
        baseZ: point.z,
        size: edgeBias ? random(0.9, 2.35) : random(0.55, 1.65),
        alpha: edgeBias ? random(0.58, 1) : random(0.22, 0.8),
        twinkle: random(0, Math.PI * 2),
        speed: random(0.45, 1.45),
        hue: Math.random() < 0.58 ? random(182, 204) : random(258, 288)
      });
    }

    state.ambient = Array.from({ length: state.width < 600 ? 22 : 36 }, () => ({
      x: Math.random() * state.width,
      y: Math.random() * state.height,
      r: random(0.25, 1.15),
      a: random(0.08, 0.32),
      drift: random(2, 9),
      phase: random(0, Math.PI * 2)
    }));
  }

  function resize() {
    state.dpr = Math.min(window.devicePixelRatio || 1, lowPowerDevice ? 1 : 1.25);
    state.width = window.innerWidth;
    state.height = window.innerHeight;
    canvas.width = Math.round(state.width * state.dpr);
    canvas.height = Math.round(state.height * state.dpr);
    canvas.style.width = `${state.width}px`;
    canvas.style.height = `${state.height}px`;
    ctx.setTransform(state.dpr, 0, 0, state.dpr, 0, 0);

    const rect = heartStage.getBoundingClientRect();
    state.stageX = rect.left + rect.width / 2;
    state.stageY = rect.top + rect.height / 2 - rect.height * 0.035;
    state.stageSize = rect.width;
    buildHeart();
  }

  function beatScale(time) {
    const cycle = (time % 2.6) / 2.6;
    const first = Math.exp(-Math.pow((cycle - 0.055) / 0.038, 2)) * 0.115;
    const second = Math.exp(-Math.pow((cycle - 0.145) / 0.047, 2)) * 0.07;
    return 1 + first + second + state.pulseKick;
  }

  function drawAmbient(time) {
    for (const mote of state.ambient) {
      const y = (mote.y - time * mote.drift + state.height * 2) % (state.height + 50) - 25;
      const x = mote.x + Math.sin(time * 0.28 + mote.phase) * 11;
      ctx.beginPath();
      ctx.fillStyle = `rgba(164, 225, 255, ${mote.a * (0.65 + Math.sin(time + mote.phase) * 0.35)})`;
      ctx.arc(x, y, mote.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawHeart(time) {
    const scale = (state.stageSize / 43) * beatScale(time);
    const perspective = 45;
    const rotation = state.rotationY + time * 0.085;
    const cosY = Math.cos(rotation);
    const sinY = Math.sin(rotation);
    const cosX = Math.cos(state.rotationX);
    const sinX = Math.sin(state.rotationX);

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let index = 0; index < state.particles.length; index += 1) {
      const particle = state.particles[index];
      const softNoise = Math.sin(time * particle.speed + particle.twinkle) * 0.06;
      const wobble = 1 + softNoise * 0.015;
      const sourceX = particle.baseX * wobble;
      const sourceY = particle.baseY * wobble;
      const sourceZ = particle.baseZ + softNoise;
      const rotatedX = sourceX * cosY - sourceZ * sinY;
      const rotatedZ = sourceX * sinY + sourceZ * cosY;
      const rotatedY = sourceY * cosX - rotatedZ * sinX;
      const depthZ = sourceY * sinX + rotatedZ * cosX;
      const depth = perspective / (perspective - depthZ);
      const x = state.stageX + rotatedX * scale * depth;
      const y = state.stageY + rotatedY * scale * depth;
      const front = Math.max(0.3, Math.min(1, (depthZ + 6) / 12));
      const flicker = 0.78 + Math.sin(time * particle.speed * 2 + particle.twinkle) * 0.22;
      const radius = particle.size * depth * (0.72 + front * 0.48);
      const alpha = particle.alpha * flicker * (0.42 + front * 0.58);
      const hue = particle.hue;

      if (index % 13 === 0 && front > 0.6) {
        ctx.beginPath();
        ctx.fillStyle = `hsla(${hue}, 100%, 62%, ${alpha * 0.1})`;
        ctx.arc(x, y, radius * 3.8, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${hue}, 96%, ${48 + front * 25}%, ${alpha})`;
      ctx.arc(x, y, Math.max(0.35, radius), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function createBurst(strength = 1) {
    const count = Math.round((state.width < 600 ? 36 : 64) * strength);
    state.pulseKick = Math.max(state.pulseKick, 0.16 * strength);

    for (let i = 0; i < count; i += 1) {
      const angle = random(0, Math.PI * 2);
      const speed = random(45, 240) * strength;
      const life = random(0.7, 1.55);
      state.sparks.push({
        x: state.stageX + random(-12, 12),
        y: state.stageY + random(-8, 16),
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - 20,
        life,
        maxLife: life,
        size: random(0.8, 2.8),
        hue: Math.random() < 0.6 ? random(178, 205) : random(255, 292)
      });
    }
    playEffect();
  }

  function drawSparks(dt) {
    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    for (let i = state.sparks.length - 1; i >= 0; i -= 1) {
      const spark = state.sparks[i];
      spark.life -= dt;
      if (spark.life <= 0) {
        state.sparks.splice(i, 1);
        continue;
      }
      spark.vx *= Math.pow(0.985, dt * 60);
      spark.vy = spark.vy * Math.pow(0.988, dt * 60) + 14 * dt;
      spark.x += spark.vx * dt;
      spark.y += spark.vy * dt;
      const alpha = Math.pow(spark.life / spark.maxLife, 1.7);
      ctx.shadowBlur = 13;
      ctx.shadowColor = `hsla(${spark.hue}, 100%, 62%, ${alpha})`;
      ctx.fillStyle = `hsla(${spark.hue}, 100%, 72%, ${alpha})`;
      ctx.beginPath();
      ctx.arc(spark.x, spark.y, spark.size * alpha, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function animate(now) {
    if (document.hidden) {
      state.rafId = 0;
      return;
    }
    const currentFrameInterval = state.gameOpen ? 100 : frameInterval;
    if (now - state.lastTime < currentFrameInterval) {
      state.rafId = requestAnimationFrame(animate);
      return;
    }
    const dt = Math.min((now - state.lastTime) / 1000, 0.05);
    state.lastTime = now;
    if (!reduceMotion) state.elapsed += dt;

    state.rotationX += (state.targetRotationX - state.rotationX) * Math.min(1, dt * 3.5);
    state.rotationY += (state.targetRotationY - state.rotationY) * Math.min(1, dt * 3.5);
    state.pulseKick *= Math.pow(0.03, dt);

    ctx.clearRect(0, 0, state.width, state.height);
    drawAmbient(state.elapsed);
    drawHeart(state.elapsed);
    drawSparks(dt);

    state.rafId = requestAnimationFrame(animate);
  }

  function updatePointer(clientX, clientY) {
    state.pointerX = clientX;
    state.pointerY = clientY;
    const dx = (clientX - state.stageX) / Math.max(1, state.stageSize);
    const dy = (clientY - state.stageY) / Math.max(1, state.stageSize);
    state.targetRotationY = Math.max(-0.5, Math.min(0.5, dx * 0.72));
    state.targetRotationX = -0.09 + Math.max(-0.28, Math.min(0.28, -dy * 0.5));
    document.documentElement.style.setProperty("--mx", `${clientX}px`);
    document.documentElement.style.setProperty("--my", `${clientY}px`);
  }

  function ensureAudio() {
    if (!state.audio) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) state.audio = new AudioContext();
    }
    if (state.audio?.state === "suspended") state.audio.resume();
    return state.audio;
  }

  function playEffect() {
    if (!state.soundOn) return;
    const audio = ensureAudio();
    if (!audio) return;
    const start = audio.currentTime;

    [0, 0.085].forEach((offset, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      osc.type = index === 0 ? "sine" : "triangle";
      osc.frequency.setValueAtTime(index === 0 ? 260 : 390, start + offset);
      osc.frequency.exponentialRampToValueAtTime(index === 0 ? 420 : 620, start + offset + 0.16);
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(index === 0 ? 0.07 : 0.045, start + offset + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.22);
      osc.connect(gain).connect(audio.destination);
      osc.start(start + offset);
      osc.stop(start + offset + 0.23);
    });
  }

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("is-visible");
    window.clearTimeout(showToast.timer);
    showToast.timer = window.setTimeout(() => toast.classList.remove("is-visible"), 2200);
  }

  function getShareUrl() {
    const shareUrl = new URL(window.location.href);
    shareUrl.searchParams.set("name", recipient);
    shareUrl.hash = "";
    return shareUrl.toString();
  }

  async function copyShareUrl(shareUrl) {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(shareUrl);
        return true;
      } catch (_) {
        // The classic copy fallback below also works for local file:// pages.
      }
    }

    const field = document.createElement("textarea");
    field.value = shareUrl;
    field.readOnly = true;
    field.setAttribute("aria-hidden", "true");
    field.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0";
    document.body.appendChild(field);
    field.focus();
    field.select();
    field.setSelectionRange(0, field.value.length);
    let copied = false;
    try {
      copied = document.execCommand("copy");
    } catch (_) {
      copied = false;
    }
    field.remove();
    return copied;
  }

  function showCopiedButton(button) {
    window.clearTimeout(button.copyStateTimer);
    button.classList.add("is-copied");
    const label = button === shareButton
      ? button.querySelector(".share-button__text")
      : button;
    const originalText = label.textContent;
    const originalAriaLabel = button.getAttribute("aria-label");
    label.textContent = "Скопировано ✓";
    button.setAttribute("aria-label", "Ссылка скопирована");
    button.copyStateTimer = window.setTimeout(() => {
      label.textContent = originalText;
      button.classList.remove("is-copied");
      if (originalAriaLabel) button.setAttribute("aria-label", originalAriaLabel);
      else button.removeAttribute("aria-label");
    }, 1900);
  }

  async function shareContent(shareData, copiedMessage, triggerButton) {
    const copied = await copyShareUrl(shareData.url);
    if (copied) {
      showToast(copiedMessage);
      showCopiedButton(triggerButton);
    } else {
      showToast("Браузер заблокировал буфер обмена");
      window.prompt("Скопируй эту ссылку:", shareData.url);
    }
  }

  function showGameScreen(screen) {
    [gameIntro, gamePlay, gameResult].forEach((node) => {
      node.classList.toggle("is-active", node === screen);
    });
  }

  function clearGameTimers() {
    window.clearTimeout(game.spawnTimer);
    window.clearInterval(game.tickTimer);
    game.spawnTimer = 0;
    game.tickTimer = 0;
  }

  function updateGameHud() {
    gameScoreNode.textContent = String(game.score).padStart(3, "0");
    gameComboNode.textContent = `×${Math.max(1, game.combo)}`;
  }

  function playGameTone(good) {
    if (!state.soundOn) return;
    const audio = ensureAudio();
    if (!audio) return;
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = good ? "sine" : "sawtooth";
    osc.frequency.setValueAtTime(good ? 440 + Math.min(game.combo, 8) * 24 : 130, now);
    osc.frequency.exponentialRampToValueAtTime(good ? 680 : 70, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(good ? 0.045 : 0.025, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  function gameBurstAt(xPercent, yPercent, good, label) {
    const x = gameArena.clientWidth * xPercent / 100;
    const y = gameArena.clientHeight * yPercent / 100;
    const color = good ? "#74e6ff" : "#ff4f7e";

    for (let index = 0; index < 8; index += 1) {
      const angle = Math.PI * 2 * index / 8 + Math.random() * 0.24;
      const distance = random(28, 70);
      const dot = document.createElement("i");
      dot.className = "game-burst";
      dot.style.left = `${x}px`;
      dot.style.top = `${y}px`;
      dot.style.setProperty("--burst-color", color);
      dot.style.setProperty("--burst-x", `${Math.cos(angle) * distance}px`);
      dot.style.setProperty("--burst-y", `${Math.sin(angle) * distance}px`);
      gameArena.appendChild(dot);
      window.setTimeout(() => dot.remove(), 600);
    }

    const floating = document.createElement("span");
    floating.className = "game-float";
    floating.textContent = label;
    floating.style.left = `${x}px`;
    floating.style.top = `${y}px`;
    floating.style.color = color;
    gameArena.appendChild(floating);
    window.setTimeout(() => floating.remove(), 650);
  }

  function scheduleGameTarget(delay = 100) {
    window.clearTimeout(game.spawnTimer);
    gameTarget.hidden = true;

    game.spawnTimer = window.setTimeout(() => {
      if (!game.active) return;
      game.targetGood = Math.random() > 0.22;
      const x = random(10, 90);
      const y = random(12, 88);
      gameTarget.style.left = `${x}%`;
      gameTarget.style.top = `${y}%`;
      gameTarget.classList.toggle("is-glitch", !game.targetGood);
      gameTarget.textContent = game.targetGood ? "✦" : "×";
      gameTarget.setAttribute("aria-label", game.targetGood ? "Поймать импульс" : "Глитч — не нажимать");
      gameTarget.hidden = false;

      const visibleFor = Math.max(470, 920 - game.score * 0.8);
      game.spawnTimer = window.setTimeout(() => {
        if (!game.active) return;
        if (game.targetGood) game.combo = 0;
        updateGameHud();
        scheduleGameTarget(70);
      }, visibleFor);
    }, delay);
  }

  function getGameRank(score) {
    if (score >= 300) return "Абсолютная легенда";
    if (score >= 210) return "Королева вайба";
    if (score >= 120) return "Вайб на максималках";
    return "Милая молния";
  }

  function finishGame() {
    if (!game.active) return;
    game.active = false;
    clearGameTimers();
    gameTarget.hidden = true;

    if (game.score > game.best) {
      game.best = game.score;
      try {
        localStorage.setItem("vibe-check-best", String(game.best));
      } catch (_) {
        // The game still works when storage is blocked.
      }
    }

    gameBestNode.textContent = String(game.best).padStart(3, "0");
    gameResultScore.textContent = String(game.score).padStart(3, "0");
    gameRank.textContent = getGameRank(game.score);
    gameResultCopy.textContent = `${recipient}, твой вайб официально подтверждён.`;
    showGameScreen(gameResult);
    createBurst(0.75);
    window.setTimeout(() => gameRetryButton.focus(), 80);
  }

  function startGame() {
    clearGameTimers();
    game.active = true;
    game.score = 0;
    game.combo = 0;
    game.endAt = performance.now() + 20000;
    gameTimeNode.textContent = "20.0";
    gameProgress.style.transform = "scaleX(1)";
    updateGameHud();
    showGameScreen(gamePlay);
    scheduleGameTarget(350);

    game.tickTimer = window.setInterval(() => {
      const remaining = Math.max(0, game.endAt - performance.now());
      gameTimeNode.textContent = (remaining / 1000).toFixed(1);
      gameProgress.style.transform = `scaleX(${remaining / 20000})`;
      if (remaining <= 0) finishGame();
    }, 80);
  }

  function openGame() {
    state.gameOpen = true;
    gameOverlay.classList.add("is-open");
    gameOverlay.setAttribute("aria-hidden", "false");
    document.body.classList.add("game-is-open");
    showGameScreen(gameIntro);
    gameBestNode.textContent = String(game.best).padStart(3, "0");
    window.setTimeout(() => gameStartButton.focus(), 80);
  }

  function closeGame() {
    game.active = false;
    clearGameTimers();
    gameTarget.hidden = true;
    state.gameOpen = false;
    gameOverlay.classList.remove("is-open");
    gameOverlay.setAttribute("aria-hidden", "true");
    document.body.classList.remove("game-is-open");
    gameOpenButton.focus();
  }

  window.addEventListener("resize", () => {
    window.clearTimeout(state.resizeTimer);
    state.resizeTimer = window.setTimeout(resize, 120);
  }, { passive: true });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (state.rafId) cancelAnimationFrame(state.rafId);
      state.rafId = 0;
      return;
    }
    state.lastTime = performance.now();
    if (!state.rafId) state.rafId = requestAnimationFrame(animate);
  });
  window.addEventListener("pointermove", (event) => updatePointer(event.clientX, event.clientY), { passive: true });
  window.addEventListener("pointerleave", () => {
    state.targetRotationX = -0.09;
    state.targetRotationY = 0;
  });

  hitbox.addEventListener("pointerdown", (event) => {
    state.pressing = true;
    hitbox.setPointerCapture?.(event.pointerId);
    createBurst(1);
  });

  hitbox.addEventListener("pointermove", (event) => {
    if (!state.pressing) return;
    const rect = heartStage.getBoundingClientRect();
    state.targetRotationY = ((event.clientX - rect.left) / rect.width - 0.5) * 1.25;
    state.targetRotationX = -((event.clientY - rect.top) / rect.height - 0.5) * 0.8;
  });

  hitbox.addEventListener("pointerup", () => { state.pressing = false; });
  hitbox.addEventListener("pointercancel", () => { state.pressing = false; });
  hitbox.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") createBurst(1);
  });

  gameOpenButton.addEventListener("click", openGame);
  gameCloseButton.addEventListener("click", closeGame);
  gameStartButton.addEventListener("click", startGame);
  gameRetryButton.addEventListener("click", startGame);

  gameTarget.addEventListener("click", (event) => {
    event.stopPropagation();
    if (!game.active) return;
    window.clearTimeout(game.spawnTimer);
    const x = Number.parseFloat(gameTarget.style.left) || 50;
    const y = Number.parseFloat(gameTarget.style.top) || 50;

    if (game.targetGood) {
      game.combo += 1;
      const points = 10 + Math.min(game.combo - 1, 8) * 2;
      game.score += points;
      gameBurstAt(x, y, true, `+${points}`);
      playGameTone(true);
    } else {
      game.score = Math.max(0, game.score - 18);
      game.combo = 0;
      gameBurstAt(x, y, false, "−18");
      playGameTone(false);
      gameArena.classList.remove("is-shaking");
      void gameArena.offsetWidth;
      gameArena.classList.add("is-shaking");
      window.setTimeout(() => gameArena.classList.remove("is-shaking"), 280);
    }

    updateGameHud();
    gameTarget.hidden = true;
    scheduleGameTarget(90);
  });

  gameArena.addEventListener("click", (event) => {
    if (!game.active || event.target === gameTarget) return;
    const previousCombo = game.combo;
    game.combo = 0;
    updateGameHud();
    if (previousCombo > 1) {
      const rect = gameArena.getBoundingClientRect();
      const x = (event.clientX - rect.left) / rect.width * 100;
      const y = (event.clientY - rect.top) / rect.height * 100;
      gameBurstAt(x, y, false, "мимо");
    }
  });

  gameShareButton.addEventListener("click", async () => {
    const resultUrl = new URL(getShareUrl());
    resultUrl.searchParams.set("score", String(game.score));
    resultUrl.searchParams.set("game", "1");
    await shareContent({
      title: `${recipient} — ${getGameRank(game.score)}`,
      text: `${recipient} набрала ${game.score} в VIBE CHECK. Сможешь больше? ✦`,
      url: resultUrl.toString()
    }, "Результат и ссылка скопированы", gameShareButton);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.gameOpen) closeGame();
  });

  soundButton.addEventListener("click", () => {
    state.soundOn = !state.soundOn;
    soundButton.setAttribute("aria-pressed", String(state.soundOn));
    soundButton.setAttribute("aria-label", state.soundOn ? "Выключить звуковые эффекты" : "Включить звуковые эффекты");
    soundLabel.textContent = state.soundOn ? "fx on" : "fx off";
    if (state.soundOn) {
      ensureAudio();
      createBurst(0.55);
    }
  });

  shareButton.addEventListener("click", async () => {
    const shareUrl = getShareUrl();
    await shareContent({
      title: document.title,
      text: `${recipient}, лови персональный вайб ✦`,
      url: shareUrl
    }, "Ссылка с именем скопирована", shareButton);
  });

  resize();
  updatePointer(state.width / 2, state.height / 2);
  state.rafId = requestAnimationFrame(animate);
  window.setTimeout(() => createBurst(0.4), reduceMotion ? 0 : 1150);
  const sharedScore = Number.parseInt(url.searchParams.get("score") || "", 10);
  if (Number.isFinite(sharedScore)) {
    window.setTimeout(() => showToast(`${recipient}: ${sharedScore} очков. Сможешь больше?`), 1700);
  }
  if (url.searchParams.get("game") === "1") {
    openGame();
  }
})();
