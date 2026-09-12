(function () {
  var state = {
    mode: "specific", // "specific" | "any"
    counts: {}, // typeId -> count (specific mode)
    anyCount: 3,
    condition: "eq", // none | eq | gte | lte
    conditionValue: 10,
    maxPeople: 5
  };

  window.PIKMIN_TYPES.forEach(function (t) {
    state.counts[t.id] = 0;
  });

  var currentTask = null;
  var logList = [];

  // ---- DOM refs ----
  var typeCountGrid = document.getElementById("typeCountGrid");
  var specificModePanel = document.getElementById("specificModePanel");
  var anyModePanel = document.getElementById("anyModePanel");
  var modeSpecificBtn = document.getElementById("modeSpecificBtn");
  var modeAnyBtn = document.getElementById("modeAnyBtn");
  var conditionSelect = document.getElementById("conditionSelect");
  var conditionValueInput = document.getElementById("conditionValue");
  var sentencePreview = document.getElementById("sentencePreview");
  var customSentence = document.getElementById("customSentence");
  var publishBtn = document.getElementById("publishBtn");
  var nextRoundBtn = document.getElementById("nextRoundBtn");
  var undoBtn = document.getElementById("undoBtn");
  var resetAllBtn = document.getElementById("resetAllBtn");
  var roundSentence = document.getElementById("roundSentence");
  var roundProgressBar = document.getElementById("roundProgressBar");
  var roundProgressText = document.getElementById("roundProgressText");
  var roundCardList = document.getElementById("roundCardList");
  var historyList = document.getElementById("historyList");
  var modeBadge = document.getElementById("modeBadge");
  var toast = document.getElementById("toast");

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add("show");
    setTimeout(function () {
      toast.classList.remove("show");
    }, 1800);
  }

  // ---- 出題種類數量格 ----
  function renderTypeCountGrid() {
    typeCountGrid.innerHTML = "";
    window.PIKMIN_TYPES.forEach(function (t) {
      var item = document.createElement("div");
      item.className = "type-count-item";

      var swatch = document.createElement("span");
      swatch.className = "type-swatch";
      swatch.style.background = t.color;

      var name = document.createElement("span");
      name.className = "type-name";
      name.textContent = t.name;

      var stepper = document.createElement("div");
      stepper.className = "stepper";

      var minus = document.createElement("button");
      minus.type = "button";
      minus.textContent = "－";
      var valueSpan = document.createElement("span");
      valueSpan.textContent = state.counts[t.id];
      var plus = document.createElement("button");
      plus.type = "button";
      plus.textContent = "＋";

      minus.addEventListener("click", function () {
        state.counts[t.id] = Math.max(0, state.counts[t.id] - 1);
        valueSpan.textContent = state.counts[t.id];
        updatePreview();
      });
      plus.addEventListener("click", function () {
        state.counts[t.id] = Math.min(9, state.counts[t.id] + 1);
        valueSpan.textContent = state.counts[t.id];
        updatePreview();
      });

      stepper.appendChild(minus);
      stepper.appendChild(valueSpan);
      stepper.appendChild(plus);

      item.appendChild(swatch);
      item.appendChild(name);
      item.appendChild(stepper);
      typeCountGrid.appendChild(item);
    });
  }

  // ---- 通用 stepper（任選種類數 / 名額）----
  document.querySelectorAll("[data-stepper]").forEach(function (el) {
    var key = el.getAttribute("data-stepper");
    var span = el.querySelector("span");
    el.querySelectorAll("button").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var delta = parseInt(btn.getAttribute("data-delta"), 10);
        var min = key === "maxPeople" ? 1 : 1;
        var max = key === "maxPeople" ? 5 : 7;
        state[key] = Math.max(min, Math.min(max, state[key] + delta));
        span.textContent = state[key];
        updatePreview();
      });
    });
  });

  modeSpecificBtn.addEventListener("click", function () {
    state.mode = "specific";
    modeSpecificBtn.classList.add("active");
    modeAnyBtn.classList.remove("active");
    specificModePanel.style.display = "";
    anyModePanel.style.display = "none";
    updatePreview();
  });

  modeAnyBtn.addEventListener("click", function () {
    state.mode = "any";
    modeAnyBtn.classList.add("active");
    modeSpecificBtn.classList.remove("active");
    specificModePanel.style.display = "none";
    anyModePanel.style.display = "";
    updatePreview();
  });

  conditionSelect.addEventListener("change", function () {
    state.condition = conditionSelect.value;
    conditionValueInput.disabled = state.condition === "none";
    updatePreview();
  });

  conditionValueInput.addEventListener("input", function () {
    state.conditionValue = parseInt(conditionValueInput.value, 10) || 0;
    updatePreview();
  });

  var conditionTextMap = {
    eq: "力量值加總剛好為",
    gte: "力量值加總至少為",
    lte: "力量值加總最多為"
  };

  function buildSentence() {
    if (state.mode === "specific") {
      var parts = window.PIKMIN_TYPES.filter(function (t) {
        return state.counts[t.id] > 0;
      }).map(function (t) {
        return state.counts[t.id] + " 隻" + t.name;
      });
      if (parts.length === 0) return "";
      var s = "需要 " + parts.join("＋");
      if (state.condition !== "none") {
        s += "，" + conditionTextMap[state.condition] + " " + state.conditionValue;
      }
      return s + "，符合的同學請上台！";
    }
    var s2 = "需要 " + state.anyCount + " 隻不同種類的皮克敏";
    if (state.condition !== "none") {
      s2 += "，" + conditionTextMap[state.condition] + " " + state.conditionValue;
    }
    return s2 + "，符合的同學請上台！";
  }

  function updatePreview() {
    var s = buildSentence();
    sentencePreview.textContent = s || "請先設定條件";
  }

  // ---- 發布任務 ----
  function makeRoundId() {
    return Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 6);
  }

  function publishTask(reuseSentence) {
    var sentence = reuseSentence
      ? (currentTask ? currentTask.sentence : buildSentence())
      : (customSentence.value.trim() || buildSentence());

    if (!sentence) {
      showToast("請先設定至少一種皮克敏條件");
      return;
    }

    var task = {
      sentence: sentence,
      maxPeople: state.maxPeople,
      roundId: makeRoundId(),
      createdAt: Date.now()
    };

    Sync.setValue("task", task).then(function () {
      showToast(reuseSentence ? "已開始下一輪！" : "任務已發布！");
      if (!reuseSentence) customSentence.value = "";
    });
  }

  publishBtn.addEventListener("click", function () {
    publishTask(false);
  });

  nextRoundBtn.addEventListener("click", function () {
    publishTask(true);
  });

  undoBtn.addEventListener("click", function () {
    Sync.removeLastItem("log").then(function (removed) {
      if (removed) {
        showToast("已撤銷：" + describeCard(removed));
      } else {
        showToast("目前沒有紀錄可以撤銷");
      }
    });
  });

  resetAllBtn.addEventListener("click", function () {
    if (!confirm("確定要清空所有任務與回報紀錄嗎？此動作無法復原，通常只在活動前測試時使用。")) {
      return;
    }
    Promise.all([Sync.clearList("log"), Sync.setValue("task", null)]).then(function () {
      showToast("已清空所有資料");
    });
  });

  function describeCard(entry) {
    var t = window.getPikminType(entry.typeId);
    return (t ? t.name : entry.typeId) + " " + entry.number + " 號";
  }

  // ---- 畫面更新 ----
  function render() {
    if (!currentTask) {
      roundSentence.textContent = "尚未發布任務";
      roundProgressBar.style.width = "0%";
      roundProgressText.textContent = "0 / 0 人已上台";
      roundCardList.innerHTML = "";
    } else {
      roundSentence.textContent = currentTask.sentence;
      var thisRound = logList.filter(function (e) {
        return e.roundId === currentTask.roundId;
      });
      var pct = currentTask.maxPeople
        ? Math.min(100, (thisRound.length / currentTask.maxPeople) * 100)
        : 0;
      roundProgressBar.style.width = pct + "%";
      roundProgressText.textContent = thisRound.length + " / " + currentTask.maxPeople + " 人已上台";
      roundCardList.innerHTML = "";
      thisRound.forEach(function (e) {
        var t = window.getPikminType(e.typeId);
        var chip = document.createElement("span");
        chip.className = "card-chip";
        chip.style.background = t ? t.color : "#ccc";
        chip.style.color = t ? t.text : "#000";
        chip.innerHTML = '<span class="dot"></span>' + (t ? t.name : e.typeId) + " " + e.number;
        roundCardList.appendChild(chip);
      });
    }
    renderHistory();
  }

  function renderHistory() {
    if (logList.length === 0) {
      historyList.innerHTML = '<p style="color:var(--muted);">尚無紀錄</p>';
      return;
    }
    var byRound = {};
    var order = [];
    logList.forEach(function (e) {
      if (!byRound[e.roundId]) {
        byRound[e.roundId] = [];
        order.push(e.roundId);
      }
      byRound[e.roundId].push(e);
    });
    order.reverse();
    historyList.innerHTML = "";
    order.forEach(function (roundId) {
      var entries = byRound[roundId];
      var div = document.createElement("div");
      div.className = "history-round";
      var sentenceDiv = document.createElement("div");
      sentenceDiv.className = "sentence";
      sentenceDiv.textContent = entries[0].sentence || "(無敘述)";
      var metaDiv = document.createElement("div");
      metaDiv.className = "meta";
      var firstTime = new Date(entries[0].timestamp);
      metaDiv.textContent =
        firstTime.toLocaleTimeString() + " · 共 " + entries.length + " 人";
      var cardsDiv = document.createElement("div");
      cardsDiv.className = "round-card-list";
      cardsDiv.style.justifyContent = "flex-start";
      entries.forEach(function (e) {
        var t = window.getPikminType(e.typeId);
        var chip = document.createElement("span");
        chip.className = "card-chip";
        chip.style.background = t ? t.color : "#ccc";
        chip.style.color = t ? t.text : "#000";
        chip.innerHTML = '<span class="dot"></span>' + (t ? t.name : e.typeId) + " " + e.number;
        cardsDiv.appendChild(chip);
      });
      div.appendChild(sentenceDiv);
      div.appendChild(metaDiv);
      div.appendChild(cardsDiv);
      historyList.appendChild(div);
    });
  }

  // ---- init ----
  renderTypeCountGrid();
  conditionValueInput.disabled = state.condition === "none";
  updatePreview();

  var mode = Sync.init();
  modeBadge.textContent = "連線模式：" + (mode === "firebase" ? "Firebase（跨裝置）" : "本機測試（同瀏覽器分頁）");
  modeBadge.className = "mode-badge " + mode;

  Sync.onValue("task", function (val) {
    currentTask = val;
    render();
  });
  Sync.onList("log", function (arr) {
    logList = arr;
    render();
  });
})();
