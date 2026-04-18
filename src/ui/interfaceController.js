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
    moveChip: documentRoot.getElementById("move-chip"),
    fireChip: documentRoot.getElementById("fire-chip"),
    focusChip: documentRoot.getElementById("focus-chip"),
    hullPips: [...documentRoot.querySelectorAll("#hull-pips .hull-pip")],
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
            : `Act ${Math.min(state.stageIndex + 1, stages.length)}`
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

      elements.moveChip.classList.add("active");
      elements.moveChip.textContent = state.input.pointerEnabled === false ? "Keys" : "Pointer";
      elements.fireChip.classList.toggle(
        "active",
        Boolean(state.input.KeyZ || state.input.Space || state.input.PointerFire)
      );
      elements.focusChip.classList.toggle(
        "active",
        Boolean(state.input.ShiftLeft || state.input.ShiftRight)
      );

      elements.hullPips.forEach((pip, index) => {
        pip.classList.toggle("is-full", index < player.hp);
      });

      if (state.boss) {
        elements.bossPanel.classList.remove("hidden");
        setText(elements.bossName, state.boss.name);
        setText(
          elements.bossPhase,
          state.boss.phases[state.boss.phaseIndex]?.name || "Final Form"
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
            ? "Every celestial front has broken. Ride the quiet while it lasts."
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
