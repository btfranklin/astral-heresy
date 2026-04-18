import { combatTuning, getChainMultiplier } from "../core/combat.js";
import { listActivePowerups } from "../core/powerups.js";

function formatTime(seconds) {
  const whole = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(whole / 60)).padStart(2, "0");
  const secs = String(whole % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

const numberFormatter = new Intl.NumberFormat("en-US");

function formatNumber(value) {
  return numberFormatter.format(Math.max(0, Math.floor(value)));
}

function setText(node, value) {
  if (node && node.textContent !== value) {
    node.textContent = value;
  }
}

function toggleClass(node, className, force) {
  if (!node) return;
  node.classList.toggle(className, force);
}

function setMeter(node, ratio) {
  if (!node) return;
  node.style.transform = `scaleX(${Math.max(0, Math.min(1, ratio))})`;
}

export function createInterfaceController(documentRoot) {
  const elements = {
    shell: documentRoot.getElementById("interface"),
    statusCopy: documentRoot.getElementById("status-copy"),
    stageLabel: documentRoot.getElementById("stage-label"),
    stageName: documentRoot.getElementById("stage-name"),
    stageProgress: documentRoot.getElementById("stage-progress"),
    runTime: documentRoot.getElementById("run-time"),
    scoreValue: documentRoot.getElementById("score-value"),
    killValue: documentRoot.getElementById("kill-value"),
    accuracyValue: documentRoot.getElementById("accuracy-value"),
    chainValue: documentRoot.getElementById("chain-value"),
    loopValue: documentRoot.getElementById("loop-value"),
    moveChip: documentRoot.getElementById("move-chip"),
    fireChip: documentRoot.getElementById("fire-chip"),
    focusChip: documentRoot.getElementById("focus-chip"),
    burstChip: documentRoot.getElementById("burst-chip"),
    hullPips: [...documentRoot.querySelectorAll("#hull-pips .hull-pip")],
    grazeProgress: documentRoot.getElementById("graze-progress"),
    grazeValue: documentRoot.getElementById("graze-value"),
    burstStocks: [...documentRoot.querySelectorAll("#burst-stocks .stock-pip")],
    weaponValue: documentRoot.getElementById("weapon-value"),
    bonusBanner: documentRoot.getElementById("bonus-banner"),
    powerupFeed: documentRoot.getElementById("powerup-feed"),
    powerupNoticeCategory: documentRoot.getElementById("powerup-notice-category"),
    powerupNoticeRole: documentRoot.getElementById("powerup-notice-role"),
    powerupNoticeSigil: documentRoot.getElementById("powerup-notice-sigil"),
    powerupNoticeTitle: documentRoot.getElementById("powerup-notice-title"),
    effectChips: [...documentRoot.querySelectorAll("#effect-strip .effect-chip")],
    bossPanel: documentRoot.getElementById("boss-panel"),
    bossName: documentRoot.getElementById("boss-name"),
    bossPhase: documentRoot.getElementById("boss-phase"),
    bossProgress: documentRoot.getElementById("boss-progress"),
    endScreen: documentRoot.getElementById("end-screen"),
    endKicker: documentRoot.getElementById("end-kicker"),
    endTitle: documentRoot.getElementById("end-title"),
    endText: documentRoot.getElementById("end-text"),
    endScore: documentRoot.getElementById("end-score"),
    endKills: documentRoot.getElementById("end-kills"),
    endAccuracy: documentRoot.getElementById("end-accuracy"),
    endTime: documentRoot.getElementById("end-time"),
  };

  return {
    sync(state, player, stages) {
      const stage = stages[state.stageIndex];
      const accuracy = state.shotsFired > 0 ? Math.round((state.shotsHit / state.shotsFired) * 100) : 0;
      const progress = state.showcase
        ? 1
        : state.boss
          ? state.boss.hp / state.boss.maxHp
          : stage
            ? state.stageTime / stage.duration
            : 1;

      elements.shell.dataset.started = state.started ? "true" : "false";
      setText(
        elements.statusCopy,
        state.showcase
          ? "Render study mode. Use direct URLs to inspect silhouettes and boss phases."
          : state.over
            ? state.victory
              ? "Convergence complete. The choir is silent."
              : "Hull failure. Wreckage drifting through the hymn."
            : state.started
              ? state.boss
                ? "Boss engaged. Collapse the core and break formation."
                : "Angelic resistance rising. Cut a path through the choir."
              : "Awaiting launch clearance"
      );
      setText(
        elements.stageLabel,
        state.showcase
          ? "Render Study"
          : state.over
            ? (state.victory ? "Run Complete" : "Run Failed")
            : `${state.loopIndex > 0 ? "Loop II · " : ""}Act ${Math.min(state.stageIndex + 1, stages.length)}`
      );
      setText(
        elements.stageName,
        state.showcase?.label || stage?.name || (state.victory ? "Convergence" : "Last Stand")
      );
      setMeter(elements.stageProgress, progress);
      setText(elements.runTime, formatTime(state.time));
      setText(elements.scoreValue, formatNumber(state.score));
      setText(elements.killValue, formatNumber(state.kills));
      setText(elements.accuracyValue, `${accuracy}%`);
      setText(elements.chainValue, `x${getChainMultiplier(state.chainLevel).toFixed(2)}`);
      setText(elements.loopValue, state.loopIndex > 0 ? "II" : "I");

      if (elements.moveChip) {
        elements.moveChip.classList.add("active");
        elements.moveChip.textContent = state.input.pointerEnabled === false ? "Keys" : "Pointer";
      }
      toggleClass(
        elements.fireChip,
        "active",
        Boolean(state.input.KeyZ || state.input.Space || state.input.PointerFire)
      );
      toggleClass(
        elements.focusChip,
        "active",
        Boolean(state.input.ShiftLeft || state.input.ShiftRight)
      );
      toggleClass(elements.burstChip, "active", Boolean(state.input.KeyX || state.feedback.burst > 0));
      setText(elements.burstChip, `Burst ${state.burstStocks}/${combatTuning.maxBurstStocks}`);

      elements.hullPips.forEach((pip, index) => {
        pip.classList.toggle("is-full", index < player.hp);
      });
      elements.burstStocks.forEach((pip, index) => {
        pip.classList.toggle("is-full", index < state.burstStocks);
      });
      setMeter(elements.grazeProgress, state.grazeCharge / combatTuning.maxGrazeCharge);
      setText(elements.grazeValue, `${state.grazeCharge}%`);
      setText(
        elements.weaponValue,
        player.weaponMode === "base"
          ? player.weaponLabel
          : `${player.weaponLabel} ${player.weaponTimer.toFixed(1)}s`
      );
      setText(
        elements.bonusBanner,
        state.loopTimer > 0
          ? "Second loop engaged. Choir patterns sharpen."
          : state.bonusTimer > 0
            ? state.bonusText
            : (player.weaponMode !== "base" ? `${player.weaponLabel} online` : "Graze to refill burst stocks.")
      );

      const powerupNotice = state.powerupNotice;
      const showPowerupFeed = powerupNotice && powerupNotice.hudTimer > 0;
      toggleClass(elements.powerupFeed, "hidden", !showPowerupFeed);
      if (showPowerupFeed) {
        setText(elements.powerupNoticeCategory, powerupNotice.category.toUpperCase());
        setText(elements.powerupNoticeRole, powerupNotice.roleTag);
        setText(elements.powerupNoticeTitle, powerupNotice.title);
        setText(
          elements.powerupNoticeSigil,
          powerupNotice.sigil === "diamond" ? "◇" : powerupNotice.sigil === "seal" ? "✦" : "⬡"
        );
        if (elements.powerupNoticeRole) {
          elements.powerupNoticeRole.style.color = powerupNotice.color;
        }
        if (elements.powerupNoticeSigil) {
          elements.powerupNoticeSigil.style.color = powerupNotice.color;
          elements.powerupNoticeSigil.style.boxShadow = `0 0 18px ${powerupNotice.color}44`;
        }
      }

      const activePowerups = listActivePowerups(player);
      elements.effectChips.forEach((chip, index) => {
        const effect = activePowerups[index];
        chip.classList.toggle("hidden", !effect);
        if (!effect) return;
        chip.textContent = `${effect.label} ${effect.timer.toFixed(1)}s`;
        chip.style.borderColor =
          effect.category === "risk"
            ? "rgba(255, 143, 143, 0.28)"
            : effect.category === "weapon"
              ? "rgba(158, 251, 255, 0.32)"
              : "rgba(121, 255, 225, 0.28)";
        chip.style.color =
          effect.category === "risk"
            ? "#ffd2b8"
            : effect.category === "weapon"
              ? "#e9ffff"
              : "#e6fff8";
      });

      if (state.boss) {
        elements.bossPanel.classList.remove("hidden");
        setText(elements.bossName, state.boss.name);
        setText(
          elements.bossPhase,
          state.boss.weakpoint
            ? `${state.boss.phases[state.boss.phaseIndex]?.name || "Final Form"} · Weakpoint Open`
            : (state.boss.phases[state.boss.phaseIndex]?.name || "Final Form")
        );
        setMeter(elements.bossProgress, state.boss.hp / state.boss.maxHp);
      } else {
        elements.bossPanel.classList.add("hidden");
      }

      if (state.over) {
        elements.endScreen.classList.remove("hidden");
        setText(elements.endKicker, state.victory ? "Mission Complete" : "Mission Failed");
        setText(elements.endTitle, state.victory ? "Convergence Complete" : "Ship Lost");
        setText(
          elements.endText,
          state.victory
            ? "Two full loops have broken. Ride the quiet while it lasts."
            : "The choir still sings. Re-arm, re-enter, and cut deeper next run."
        );
        setText(elements.endScore, formatNumber(state.score));
        setText(elements.endKills, formatNumber(state.kills));
        setText(elements.endAccuracy, `${accuracy}%`);
        setText(elements.endTime, formatTime(state.time));
      } else {
        elements.endScreen.classList.add("hidden");
      }
    },
  };
}
