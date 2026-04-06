const svgNamespace = "http://www.w3.org/2000/svg";

const state = {
  running: true,
  requestRate: 8,
  strategy: "weighted",
  awsWeight: 55,
  requestId: 0,
  roundRobinIndex: 0,
  inFlight: [],
  metrics: createEmptyMetrics(),
  providers: {
    aws: {
      key: "aws",
      label: "AWS",
      healthy: true,
      baseLatency: 120,
      nodes: [
        { x: 150, y: 200 },
        { x: 350, y: 200 },
        { x: 550, y: 200 },
        { x: 700, y: 120 },
        { x: 825, y: 120 },
      ],
    },
    gcp: {
      key: "gcp",
      label: "GCP",
      healthy: true,
      baseLatency: 140,
      nodes: [
        { x: 150, y: 200 },
        { x: 350, y: 200 },
        { x: 550, y: 200 },
        { x: 700, y: 280 },
        { x: 825, y: 280 },
      ],
    },
  },
};

const ui = {
  requestLayer: document.getElementById("requestLayer"),
  strategySelect: document.getElementById("strategySelect"),
  rateRange: document.getElementById("rateRange"),
  awsWeightRange: document.getElementById("awsWeightRange"),
  rateValue: document.getElementById("rateValue"),
  weightValue: document.getElementById("weightValue"),
  toggleRunBtn: document.getElementById("toggleRunBtn"),
  burstBtn: document.getElementById("burstBtn"),
  resetBtn: document.getElementById("resetBtn"),
  toggleAwsBtn: document.getElementById("toggleAwsBtn"),
  toggleGcpBtn: document.getElementById("toggleGcpBtn"),
  lbModeText: document.getElementById("lbModeText"),
  heroTotalRequests: document.getElementById("heroTotalRequests"),
  heroSuccessRate: document.getElementById("heroSuccessRate"),
  heroLatency: document.getElementById("heroLatency"),
  heroInFlight: document.getElementById("heroInFlight"),
  awsShareBar: document.getElementById("awsShareBar"),
  gcpShareBar: document.getElementById("gcpShareBar"),
  awsShareValue: document.getElementById("awsShareValue"),
  gcpShareValue: document.getElementById("gcpShareValue"),
  awsLatencyBadge: document.getElementById("awsLatencyBadge"),
  gcpLatencyBadge: document.getElementById("gcpLatencyBadge"),
  awsStatus: document.getElementById("awsStatus"),
  gcpStatus: document.getElementById("gcpStatus"),
  awsNode: document.getElementById("awsNode"),
  gcpNode: document.getElementById("gcpNode"),
  weightControl: document.getElementById("weightControl"),
};

function createEmptyMetrics() {
  return {
    totalCompleted: 0,
    dropped: 0,
    providerCounts: { aws: 0, gcp: 0 },
    providerLatencySum: { aws: 0, gcp: 0 },
    providerLatencyCount: { aws: 0, gcp: 0 },
  };
}

function healthyProviders() {
  return Object.values(state.providers)
    .filter((provider) => provider.healthy)
    .map((provider) => provider.key);
}

function chooseProvider() {
  const healthy = healthyProviders();

  if (healthy.length === 0) return null;
  if (healthy.length === 1) return healthy[0];

  if (state.strategy === "roundRobin") {
    const provider = healthy[state.roundRobinIndex % healthy.length];
    state.roundRobinIndex += 1;
    return provider;
  }

  if (state.strategy === "latency") {
    const awsLatency = observedLatency("aws");
    const gcpLatency = observedLatency("gcp");
    const total = 1 / awsLatency + 1 / gcpLatency;
    const awsChance = 1 / awsLatency / total;
    return Math.random() <= awsChance ? "aws" : "gcp";
  }

  if (state.strategy === "failover") {
    return state.providers.aws.healthy ? "aws" : "gcp";
  }

  const awsChance = state.awsWeight / 100;
  return Math.random() <= awsChance ? "aws" : "gcp";
}

function observedLatency(providerKey) {
  const count = state.metrics.providerLatencyCount[providerKey];
  if (!count) return state.providers[providerKey].baseLatency;
  return state.metrics.providerLatencySum[providerKey] / count;
}

function buildPath(providerKey) {
  return state.providers[providerKey].nodes;
}

function requestDuration(providerKey) {
  const base = state.providers[providerKey].baseLatency;
  const jitter = 20 + Math.random() * 60;
  return base + jitter;
}

function spawnRequest(forcedCount = 1) {
  for (let index = 0; index < forcedCount; index += 1) {
    const providerKey = chooseProvider();

    if (!providerKey) {
      state.metrics.dropped += 1;
      continue;
    }

    const request = createRequest(providerKey);
    state.inFlight.push(request);
  }
}

function createRequest(providerKey) {
  const duration = requestDuration(providerKey);
  const element = document.createElementNS(svgNamespace, "circle");
  element.setAttribute("r", "5");
  element.setAttribute("cx", "150");
  element.setAttribute("cy", "200");
  element.classList.add("request-dot", providerKey);
  ui.requestLayer.appendChild(element);

  return {
    id: ++state.requestId,
    providerKey,
    createdAt: performance.now(),
    duration,
    points: buildPath(providerKey),
    element,
  };
}

function updateRequests(now) {
  const active = [];

  state.inFlight.forEach((request) => {
    const progress = Math.min((now - request.createdAt) / request.duration, 1);
    const { x, y } = pointAlongPolyline(request.points, easeOutCubic(progress));
    request.element.setAttribute("cx", x.toFixed(2));
    request.element.setAttribute("cy", y.toFixed(2));

    if (progress >= 1) {
      completeRequest(request);
      request.element.remove();
      return;
    }

    active.push(request);
  });

  state.inFlight = active;
}

function pointAlongPolyline(points, progress) {
  let totalLength = 0;
  const segments = [];

  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index];
    const end = points[index + 1];
    const length = Math.hypot(end.x - start.x, end.y - start.y);
    segments.push({ start, end, length });
    totalLength += length;
  }

  if (!segments.length || totalLength === 0) return points[0];

  let remaining = progress * totalLength;

  for (const segment of segments) {
    if (remaining <= segment.length) {
      const local = segment.length === 0 ? 0 : remaining / segment.length;
      return {
        x: segment.start.x + (segment.end.x - segment.start.x) * local,
        y: segment.start.y + (segment.end.y - segment.start.y) * local,
      };
    }
    remaining -= segment.length;
  }

  return segments[segments.length - 1].end;
}

function completeRequest(request) {
  const providerKey = request.providerKey;
  const duration = Math.round(request.duration);
  state.metrics.totalCompleted += 1;
  state.metrics.providerCounts[providerKey] += 1;
  state.metrics.providerLatencySum[providerKey] += duration;
  state.metrics.providerLatencyCount[providerKey] += 1;
}

function updateHealth(providerKey, healthy) {
  state.providers[providerKey].healthy = healthy;
  syncUi();
}

function syncUi() {
  const gcpWeight = 100 - state.awsWeight;
  ui.rateValue.textContent = `${state.requestRate} req/s`;
  ui.weightValue.textContent = `${state.awsWeight}/${gcpWeight}`;
  ui.strategySelect.value = state.strategy;
  ui.awsWeightRange.value = String(state.awsWeight);
  ui.awsWeightRange.disabled = state.strategy !== "weighted";
  ui.weightControl.style.opacity = state.strategy === "weighted" ? "1" : "0.5";
  ui.rateRange.value = String(state.requestRate);
  ui.lbModeText.textContent = labelForStrategy(state.strategy);
  ui.toggleRunBtn.textContent = state.running ? "⏸ Pause" : "▶ Resume";

  const awsHealthy = state.providers.aws.healthy;
  const gcpHealthy = state.providers.gcp.healthy;

  ui.toggleAwsBtn.textContent = awsHealthy ? "AWS Online" : "AWS Offline";
  ui.toggleGcpBtn.textContent = gcpHealthy ? "GCP Online" : "GCP Offline";
  ui.toggleAwsBtn.classList.toggle("offline", !awsHealthy);
  ui.toggleGcpBtn.classList.toggle("offline", !gcpHealthy);

  ui.awsNode.classList.toggle("offline", !awsHealthy);
  ui.gcpNode.classList.toggle("offline", !gcpHealthy);

  ui.awsStatus.textContent = awsHealthy ? "Online" : "Offline";
  ui.gcpStatus.textContent = gcpHealthy ? "Online" : "Offline";

  refreshMetrics();
}

function refreshMetrics() {
  const totalResolved = state.metrics.totalCompleted + state.metrics.dropped;
  const successRate =
    totalResolved === 0
      ? 100
      : (state.metrics.totalCompleted / totalResolved) * 100;
  const overallLatency = averageLatency();
  const providerTotal =
    state.metrics.providerCounts.aws + state.metrics.providerCounts.gcp;
  const awsShare =
    providerTotal === 0
      ? 0
      : (state.metrics.providerCounts.aws / providerTotal) * 100;
  const gcpShare =
    providerTotal === 0
      ? 0
      : (state.metrics.providerCounts.gcp / providerTotal) * 100;

  ui.heroTotalRequests.textContent = String(state.metrics.totalCompleted);
  ui.heroSuccessRate.textContent = `${successRate.toFixed(1)}%`;
  ui.heroLatency.textContent = `${Math.round(overallLatency)} ms`;
  ui.heroInFlight.textContent = String(state.inFlight.length);

  ui.awsShareBar.style.width = `${awsShare}%`;
  ui.gcpShareBar.style.width = `${gcpShare}%`;
  ui.awsShareValue.textContent = `${Math.round(awsShare)}%`;
  ui.gcpShareValue.textContent = `${Math.round(gcpShare)}%`;

  ui.awsLatencyBadge.textContent = `${Math.round(observedLatency("aws"))} ms`;
  ui.gcpLatencyBadge.textContent = `${Math.round(observedLatency("gcp"))} ms`;
}

function averageLatency() {
  const totalCount =
    state.metrics.providerLatencyCount.aws +
    state.metrics.providerLatencyCount.gcp;
  if (!totalCount) {
    return (
      (state.providers.aws.baseLatency + state.providers.gcp.baseLatency) / 2
    );
  }
  const totalSum =
    state.metrics.providerLatencySum.aws + state.metrics.providerLatencySum.gcp;
  return totalSum / totalCount;
}

function labelForStrategy(strategy) {
  if (strategy === "roundRobin") return "Round Robin";
  if (strategy === "latency") return "Latency Aware";
  if (strategy === "failover") return "Failover";
  return "Weighted";
}

function resetMetrics() {
  state.metrics = createEmptyMetrics();
  state.inFlight.forEach((request) => request.element.remove());
  state.inFlight = [];
  state.requestId = 0;
  state.roundRobinIndex = 0;
  spawnCarry = 0;
  syncUi();
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function bindEvents() {
  ui.strategySelect.addEventListener("change", (event) => {
    state.strategy = event.target.value;
    syncUi();
  });

  ui.rateRange.addEventListener("input", (event) => {
    state.requestRate = Number(event.target.value);
    syncUi();
  });

  ui.awsWeightRange.addEventListener("input", (event) => {
    state.awsWeight = Number(event.target.value);
    syncUi();
  });

  ui.toggleRunBtn.addEventListener("click", () => {
    state.running = !state.running;
    syncUi();
  });

  ui.burstBtn.addEventListener("click", () => {
    spawnRequest(30);
    syncUi();
  });

  ui.resetBtn.addEventListener("click", resetMetrics);
  ui.toggleAwsBtn.addEventListener("click", () =>
    updateHealth("aws", !state.providers.aws.healthy),
  );
  ui.toggleGcpBtn.addEventListener("click", () =>
    updateHealth("gcp", !state.providers.gcp.healthy),
  );
}

let lastFrame = performance.now();
let spawnCarry = 0;

function loop(now) {
  const deltaSeconds = Math.min((now - lastFrame) / 1000, 0.12);
  lastFrame = now;

  if (state.running) {
    spawnCarry += deltaSeconds * state.requestRate;
    while (spawnCarry >= 1) {
      spawnRequest();
      spawnCarry -= 1;
    }
  }

  updateRequests(now);
  refreshMetrics();
  window.requestAnimationFrame(loop);
}

bindEvents();
syncUi();
window.requestAnimationFrame(loop);
