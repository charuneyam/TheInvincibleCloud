const svgNamespace = "http://www.w3.org/2000/svg";

const state = {
  running: true,
  requestRate: 8,
  strategy: "weighted",
  awsWeight: 55,
  requestId: 0,
  roundRobinIndex: 0,
  inFlight: [],
  recentEvents: [],
  metrics: createEmptyMetrics(),
  providers: {
    aws: {
      key: "aws",
      label: "AWS",
      healthy: true,
      nextPod: 0,
      baseLatency: 1220,
      nodes: [
        { x: 250, y: 350 },
        { x: 320, y: 350 },
        { x: 570, y: 350 },
        { x: 630, y: 350 },
        { x: 630, y: 165 },
        { x: 700, y: 165 },
        { x: 910, y: 165 },
        { x: 970, y: 165 },
      ],
      pods: [
        { x: 1118, y: 196 },
        { x: 1118, y: 231 },
        { x: 1118, y: 266 },
      ],
    },
    gcp: {
      key: "gcp",
      label: "GCP",
      healthy: true,
      nextPod: 0,
      baseLatency: 1360,
      nodes: [
        { x: 250, y: 350 },
        { x: 320, y: 350 },
        { x: 570, y: 350 },
        { x: 630, y: 350 },
        { x: 630, y: 530 },
        { x: 700, y: 530 },
        { x: 910, y: 530 },
        { x: 970, y: 530 },
      ],
      pods: [
        { x: 1118, y: 536 },
        { x: 1118, y: 571 },
        { x: 1118, y: 606 },
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
  destroyAwsBtn: document.getElementById("destroyAwsBtn"),
  demoMessage: document.getElementById("demoMessage"),
  systemStatusPill: document.getElementById("systemStatusPill"),
  systemStatusCopy: document.getElementById("systemStatusCopy"),
  strategyHint: document.getElementById("strategyHint"),
  lbModeText: document.getElementById("lbModeText"),
  heroTotalRequests: document.getElementById("heroTotalRequests"),
  heroSuccessRate: document.getElementById("heroSuccessRate"),
  heroLatency: document.getElementById("heroLatency"),
  heroInFlight: document.getElementById("heroInFlight"),
  awsShareBar: document.getElementById("awsShareBar"),
  gcpShareBar: document.getElementById("gcpShareBar"),
  awsShareValue: document.getElementById("awsShareValue"),
  gcpShareValue: document.getElementById("gcpShareValue"),
  awsShareDetail: document.getElementById("awsShareDetail"),
  gcpShareDetail: document.getElementById("gcpShareDetail"),
  awsServiceCard: document.getElementById("awsServiceCard"),
  gcpServiceCard: document.getElementById("gcpServiceCard"),
  awsHealthBadge: document.getElementById("awsHealthBadge"),
  gcpHealthBadge: document.getElementById("gcpHealthBadge"),
  awsLatencyBadge: document.getElementById("awsLatencyBadge"),
  gcpLatencyBadge: document.getElementById("gcpLatencyBadge"),
  awsPodSummary: document.getElementById("awsPodSummary"),
  gcpPodSummary: document.getElementById("gcpPodSummary"),
  awsEdgeStatus: document.getElementById("awsEdgeStatus"),
  gcpEdgeStatus: document.getElementById("gcpEdgeStatus"),
  eventLog: document.getElementById("eventLog"),
  awsLane: document.querySelector(".aws-lane"),
  gcpLane: document.querySelector(".gcp-lane"),
  awsEdgeNode: document.getElementById("awsEdgeNode"),
  gcpEdgeNode: document.getElementById("gcpEdgeNode"),
  awsClusterNode: document.getElementById("awsClusterNode"),
  gcpClusterNode: document.getElementById("gcpClusterNode"),
  awsPodRects: [
    document.getElementById("awsPod0"),
    document.getElementById("awsPod1"),
    document.getElementById("awsPod2"),
  ],
  gcpPodRects: [
    document.getElementById("gcpPod0"),
    document.getElementById("gcpPod1"),
    document.getElementById("gcpPod2"),
  ],
  awsPodCounts: [
    document.getElementById("awsPod0Count"),
    document.getElementById("awsPod1Count"),
    document.getElementById("awsPod2Count"),
  ],
  gcpPodCounts: [
    document.getElementById("gcpPod0Count"),
    document.getElementById("gcpPod1Count"),
    document.getElementById("gcpPod2Count"),
  ],
};

const strategyHints = {
  weighted: "Weighted routing splits traffic between both healthy providers using the slider below.",
  roundRobin: "Round robin alternates requests between AWS and GCP when both lanes are healthy.",
  latency: "Latency aware routing prefers the provider with the better observed response time.",
  failover: "Failover keeps AWS as the primary target and shifts all traffic to GCP only when AWS is unavailable.",
};

function createEmptyMetrics() {
  return {
    totalCompleted: 0,
    dropped: 0,
    providerCounts: { aws: 0, gcp: 0 },
    providerLatencySum: { aws: 0, gcp: 0 },
    providerLatencyCount: { aws: 0, gcp: 0 },
    podCounts: {
      aws: [0, 0, 0],
      gcp: [0, 0, 0],
    },
  };
}

function healthyProviders() {
  return Object.values(state.providers)
    .filter((provider) => provider.healthy)
    .map((provider) => provider.key);
}

function chooseProvider() {
  const healthy = healthyProviders();

  if (healthy.length === 0) {
    return null;
  }

  if (healthy.length === 1) {
    return healthy[0];
  }

  if (state.strategy === "roundRobin") {
    const provider = healthy[state.roundRobinIndex % healthy.length];
    state.roundRobinIndex += 1;
    return provider;
  }

  if (state.strategy === "latency") {
    const awsLatency = observedLatency("aws");
    const gcpLatency = observedLatency("gcp");
    const total = (1 / awsLatency) + (1 / gcpLatency);
    const awsChance = (1 / awsLatency) / total;
    return Math.random() <= awsChance ? "aws" : "gcp";
  }

  if (state.strategy === "failover") {
    return state.providers.aws.healthy ? "aws" : "gcp";
  }

  const awsChance = state.awsWeight / 100;
  return Math.random() <= awsChance ? "aws" : "gcp";
}

function choosePod(providerKey) {
  const provider = state.providers[providerKey];
  const podIndex = provider.nextPod % provider.pods.length;
  provider.nextPod += 1;
  return podIndex;
}

function observedLatency(providerKey) {
  const count = state.metrics.providerLatencyCount[providerKey];
  if (!count) {
    return state.providers[providerKey].baseLatency;
  }

  return state.metrics.providerLatencySum[providerKey] / count;
}

function buildPath(providerKey, podIndex) {
  const provider = state.providers[providerKey];
  return [...provider.nodes, provider.pods[podIndex]];
}

function requestDuration(providerKey) {
  const base = state.providers[providerKey].baseLatency;
  const jitter = 140 + Math.random() * 420;
  return base + jitter;
}

function spawnRequest(forcedCount = 1) {
  for (let index = 0; index < forcedCount; index += 1) {
    const providerKey = chooseProvider();

    if (!providerKey) {
      state.metrics.dropped += 1;
      if (state.metrics.dropped <= 3 || state.metrics.dropped % 10 === 0) {
        pushEvent("All providers unavailable. Request dropped at the edge.", "error");
      }
      continue;
    }

    const podIndex = choosePod(providerKey);
    const request = createRequest(providerKey, podIndex);
    state.inFlight.push(request);
  }
}

function createRequest(providerKey, podIndex) {
  const duration = requestDuration(providerKey);
  const element = document.createElementNS(svgNamespace, "circle");
  element.setAttribute("r", "6");
  element.setAttribute("cx", "250");
  element.setAttribute("cy", "350");
  element.classList.add("request-dot", providerKey);
  ui.requestLayer.appendChild(element);

  return {
    id: ++state.requestId,
    providerKey,
    podIndex,
    createdAt: performance.now(),
    duration,
    points: buildPath(providerKey, podIndex),
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

  if (!segments.length || totalLength === 0) {
    return points[0];
  }

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
  state.metrics.podCounts[providerKey][request.podIndex] += 1;

  pulsePod(providerKey, request.podIndex);

  if (state.metrics.totalCompleted <= 8 || state.metrics.totalCompleted % 8 === 0) {
    pushEvent(
      `${state.providers[providerKey].label} served request #${request.id} via pod ${request.podIndex + 1} in ${duration} ms.`,
      providerKey,
    );
  }
}

function pulsePod(providerKey, podIndex) {
  const podRect =
    providerKey === "aws" ? ui.awsPodRects[podIndex] : ui.gcpPodRects[podIndex];
  podRect.classList.remove("pulse");
  window.requestAnimationFrame(() => podRect.classList.add("pulse"));
  window.setTimeout(() => podRect.classList.remove("pulse"), 700);
}

function pushEvent(message, kind) {
  const stamp = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });

  const entry = { stamp, kind, message };
  state.recentEvents.unshift(entry);
  state.recentEvents = state.recentEvents.slice(0, 7);
  renderEvents();
}

function renderEvents() {
  ui.eventLog.innerHTML = "";

  state.recentEvents.forEach((entry) => {
    const item = document.createElement("li");
    item.dataset.kind = entry.kind;
    item.innerHTML = `<strong>${entry.stamp}</strong> ${entry.message}`;
    ui.eventLog.appendChild(item);
  });
}

function updateHealth(providerKey, healthy) {
  state.providers[providerKey].healthy = healthy;
  const providerLabel = state.providers[providerKey].label;

  if (!healthy) {
    pushEvent(`${providerLabel} marked offline. Load balancer will route away from this lane.`, "error");
  } else {
    pushEvent(`${providerLabel} recovered and is accepting traffic again.`, providerKey);
  }

  syncUi();
}

function syncUi() {
  const gcpWeight = 100 - state.awsWeight;
  ui.rateValue.textContent = `${state.requestRate} req/s`;
  ui.weightValue.textContent = `${state.awsWeight} / ${gcpWeight}`;
  ui.strategySelect.value = state.strategy;
  ui.awsWeightRange.value = String(state.awsWeight);
  ui.awsWeightRange.disabled = state.strategy !== "weighted";
  ui.rateRange.value = String(state.requestRate);
  ui.strategyHint.textContent = strategyHints[state.strategy];
  ui.lbModeText.textContent = labelForStrategy(state.strategy);
  ui.toggleRunBtn.textContent = state.running ? "Pause ingress" : "Resume ingress";

  const awsHealthy = state.providers.aws.healthy;
  const gcpHealthy = state.providers.gcp.healthy;

  ui.toggleAwsBtn.textContent = awsHealthy ? "AWS online" : "AWS offline";
  ui.toggleGcpBtn.textContent = gcpHealthy ? "GCP online" : "GCP offline";
  ui.toggleAwsBtn.classList.toggle("offline", !awsHealthy);
  ui.toggleGcpBtn.classList.toggle("offline", !gcpHealthy);

  ui.awsServiceCard.classList.toggle("degraded", !awsHealthy);
  ui.gcpServiceCard.classList.toggle("degraded", !gcpHealthy);
  ui.awsLane.classList.toggle("dimmed", !awsHealthy);
  ui.gcpLane.classList.toggle("dimmed", !gcpHealthy);
  ui.awsEdgeNode.classList.toggle("offline", !awsHealthy);
  ui.awsClusterNode.classList.toggle("offline", !awsHealthy);
  ui.gcpEdgeNode.classList.toggle("offline", !gcpHealthy);
  ui.gcpClusterNode.classList.toggle("offline", !gcpHealthy);

  ui.awsHealthBadge.textContent = awsHealthy ? "Healthy" : "Offline";
  ui.gcpHealthBadge.textContent = gcpHealthy ? "Healthy" : "Offline";
  ui.awsEdgeStatus.textContent = awsHealthy ? "Healthy and accepting traffic" : "Offline and removed from routing";
  ui.gcpEdgeStatus.textContent = gcpHealthy ? "Healthy and accepting traffic" : "Offline and removed from routing";
  ui.awsPodSummary.textContent = awsHealthy ? "3 pods online" : "0 pods reachable";
  ui.gcpPodSummary.textContent = gcpHealthy ? "3 pods online" : "0 pods reachable";

  const healthy = healthyProviders();
  ui.systemStatusPill.classList.remove("warning", "danger");
  if (healthy.length === 2) {
    ui.systemStatusPill.textContent = "Both providers healthy";
    ui.systemStatusCopy.textContent = "Requests enter through the EC2 NGINX edge and are distributed to healthy AWS and GCP clusters.";
  } else if (healthy.length === 1) {
    ui.systemStatusPill.textContent = `${state.providers[healthy[0]].label} only`;
    ui.systemStatusPill.classList.add("warning");
    ui.systemStatusCopy.textContent = `${state.providers[healthy[0]].label} is the only healthy destination. The load balancer is routing all traffic to that provider.`;
  } else {
    ui.systemStatusPill.textContent = "No healthy targets";
    ui.systemStatusPill.classList.add("danger");
    ui.systemStatusCopy.textContent = "Both providers are unavailable. New requests are currently dropped at the edge.";
  }

  refreshMetrics();
}

const displayValues = {
  totalRequests: 0,
  successRate: 100,
  latency: 0,
  inFlight: 0,
};

function lerpDisplay(current, target, speed) {
  if (Math.abs(target - current) < 0.5) return target;
  return current + (target - current) * speed;
}

function refreshMetrics() {
  const totalResolved = state.metrics.totalCompleted + state.metrics.dropped;
  const successRate = totalResolved === 0 ? 100 : (state.metrics.totalCompleted / totalResolved) * 100;
  const overallLatency = averageLatency();
  const providerTotal = state.metrics.providerCounts.aws + state.metrics.providerCounts.gcp;
  const awsShare = providerTotal === 0 ? 0 : (state.metrics.providerCounts.aws / providerTotal) * 100;
  const gcpShare = providerTotal === 0 ? 0 : (state.metrics.providerCounts.gcp / providerTotal) * 100;

  displayValues.totalRequests = lerpDisplay(displayValues.totalRequests, state.metrics.totalCompleted, 0.18);
  displayValues.successRate = lerpDisplay(displayValues.successRate, successRate, 0.12);
  displayValues.latency = lerpDisplay(displayValues.latency, overallLatency, 0.1);
  displayValues.inFlight = lerpDisplay(displayValues.inFlight, state.inFlight.length, 0.25);

  ui.heroTotalRequests.textContent = String(Math.round(displayValues.totalRequests));
  ui.heroSuccessRate.textContent = `${displayValues.successRate.toFixed(1)}%`;
  ui.heroLatency.textContent = `${Math.round(displayValues.latency)} ms`;
  ui.heroInFlight.textContent = String(Math.round(displayValues.inFlight));

  ui.awsShareBar.style.width = `${awsShare}%`;
  ui.gcpShareBar.style.width = `${gcpShare}%`;
  ui.awsShareValue.textContent = `${Math.round(awsShare)}%`;
  ui.gcpShareValue.textContent = `${Math.round(gcpShare)}%`;
  ui.awsShareDetail.textContent = `${state.metrics.providerCounts.aws} requests routed to Amazon EKS.`;
  ui.gcpShareDetail.textContent = `${state.metrics.providerCounts.gcp} requests routed to GKE Autopilot.`;

  ui.awsLatencyBadge.textContent = `${Math.round(observedLatency("aws"))} ms avg`;
  ui.gcpLatencyBadge.textContent = `${Math.round(observedLatency("gcp"))} ms avg`;

  state.metrics.podCounts.aws.forEach((count, index) => {
    ui.awsPodCounts[index].textContent = String(count);
  });

  state.metrics.podCounts.gcp.forEach((count, index) => {
    ui.gcpPodCounts[index].textContent = String(count);
  });
}

function averageLatency() {
  const totalCount = state.metrics.providerLatencyCount.aws + state.metrics.providerLatencyCount.gcp;
  if (!totalCount) {
    return (state.providers.aws.baseLatency + state.providers.gcp.baseLatency) / 2;
  }

  const totalSum = state.metrics.providerLatencySum.aws + state.metrics.providerLatencySum.gcp;
  return totalSum / totalCount;
}

function labelForStrategy(strategy) {
  if (strategy === "roundRobin") {
    return "Round robin";
  }
  if (strategy === "latency") {
    return "Latency aware";
  }
  if (strategy === "failover") {
    return "Failover";
  }
  return "Weighted";
}

function resetMetrics() {
  state.metrics = createEmptyMetrics();
  state.recentEvents = [];
  state.inFlight.forEach((request) => request.element.remove());
  state.inFlight = [];
  state.requestId = 0;
  state.roundRobinIndex = 0;
  state.providers.aws.nextPod = 0;
  state.providers.gcp.nextPod = 0;
  spawnCarry = 0;
  renderEvents();
  pushEvent("Simulation counters reset. Traffic continues with the current routing policy.", "info");
  syncUi();
}

function easeOutCubic(value) {
  return 1 - (1 - value) ** 3;
}

function destroyAws() {
  if (!state.providers.aws.healthy) {
    // AWS is already destroyed, restore it
    updateHealth("aws", true);
    ui.destroyAwsBtn.textContent = "💥 Destroy AWS";
    ui.destroyAwsBtn.classList.remove("recover-btn");
    ui.destroyAwsBtn.classList.add("destroy-btn");
    ui.demoMessage.textContent = "Click the button to simulate a catastrophic AWS failure and watch traffic seamlessly redirect to GCP with zero downtime!";
    ui.demoMessage.parentElement.classList.remove("success");
    pushEvent("🔧 AWS infrastructure restored. Load balancer resuming normal operations.", "aws");
  } else {
    // Destroy AWS
    updateHealth("aws", false);
    ui.destroyAwsBtn.textContent = "✅ Restore AWS";
    ui.destroyAwsBtn.classList.remove("destroy-btn");
    ui.destroyAwsBtn.classList.add("recover-btn");
    ui.demoMessage.textContent = "✨ AWS destroyed! Notice how all traffic automatically failed over to GCP with ZERO downtime. The application continues to serve requests flawlessly!";
    ui.demoMessage.parentElement.classList.add("success");
    pushEvent("💥 CATASTROPHIC FAILURE: AWS region destroyed! Load balancer initiating emergency failover to GCP...", "error");
    
    // Show success message after a brief delay
    setTimeout(() => {
      pushEvent("✅ SUCCESS: All traffic now routing through GCP. Zero requests dropped. System remains fully operational!", "gcp");
    }, 1000);
  }
}

function bindEvents() {
  ui.strategySelect.addEventListener("change", (event) => {
    state.strategy = event.target.value;
    pushEvent(`Load balancer strategy changed to ${labelForStrategy(state.strategy)}.`, "info");
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
    pushEvent(state.running ? "Ingress resumed. New requests are flowing again." : "Ingress paused. Existing requests will drain.", "info");
    syncUi();
  });

  ui.burstBtn.addEventListener("click", () => {
    spawnRequest(30);
    pushEvent("Manual traffic burst injected at the edge: 30 requests.", "info");
    syncUi();
  });

  ui.resetBtn.addEventListener("click", resetMetrics);
  ui.toggleAwsBtn.addEventListener("click", () => updateHealth("aws", !state.providers.aws.healthy));
  ui.toggleGcpBtn.addEventListener("click", () => updateHealth("gcp", !state.providers.gcp.healthy));
  ui.destroyAwsBtn.addEventListener("click", destroyAws);
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
pushEvent("Simulation online. Multi-cloud traffic is now flowing through the edge load balancer.", "info");
pushEvent("AWS and GCP lanes are healthy. Weighted routing starts at a 55 / 45 split.", "info");
syncUi();
window.requestAnimationFrame(loop);
