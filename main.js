// localStorage.clear();


let map;
let networkLine = null;
let allTrees = [];
const markerMap = {};
let drawCircle;
let exploreButton;

let lastMessageTimes = {};

const personalities = [{
    type: "Cheerful",
    delay: 300,
    color: "#FFEB3B"
  },
  {
    type: "Calm",
    delay: 1500,
    color: "#AED581"
  },
  {
    type: "Lazy",
    delay: 3000,
    color: "#BCAAA4"
  },
  {
    type: "Talkative",
    delay: 500,
    color: "#FFB74D"
  },
  {
    type: "Silent",
    delay: 4000,
    color: "#90A4AE"
  }
];

let networkVisible = false;

function toggleNetwork() {
  if (networkVisible) {
    hideNetwork();
  } else {
    showNetwork();
  }
}

function showNetwork() {
  networkVisible = true;
  document.getElementById('toggle-network-btn').innerText = "🙈 Hide My Connections";

    loadMyNetworkTrees(); // 重画 networkLine 和 marker

}

function hideNetwork() {
  networkVisible = false;
  document.getElementById('toggle-network-btn').innerText = "👥 View My Connections";
  if (networkLine) {
    
    map.removeLayer(networkLine);
    networkLine = null;
  }

  const myTreeIds = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  myTreeIds.forEach(id => {
    if (markerMap[id]) {
      map.removeLayer(markerMap[id]);
      delete markerMap[id];
    }
  });
}


function startExplore() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('map-screen').style.display = 'flex';

  initMap();
  initSelectionBox();

  document.getElementById('toggle-network-btn').style.display = 'inline-block';
  hideNetwork(); // 初始隐藏
}

function startNetwork() {
  document.getElementById('home-screen').style.display = 'none';
  document.getElementById('map-screen').style.display = 'flex';

  initMap();
  initSelectionBox();
  document.getElementById('toggle-network-btn').style.display = 'inline-block';
  showNetwork(); // 初始显示 network
}

function backHome() {
  window.location.reload();
}

function initMap() {
  if (map) return;

  const nycBounds = L.latLngBounds(
    [40.4774, -74.2591],
    [40.9176, -73.7004]
  );

  map = L.map('map', {
    editable: true,
    maxBounds: nycBounds,
    maxBoundsViscosity: 1.0,
    minZoom: 13
  }).setView([40.6930336, -73.9872615], 15);

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: 'abcd',
    maxZoom: 19
  }).addTo(map);
}

function initSelectionBox() {
  const center = L.latLng(40.6930336, -73.9872615); // 中心点
  const radius = 300; // 半径，单位是米

  drawCircle = L.circle(center, {
    radius: radius,
    color: "#4caf50",
    weight: 2,
    fillOpacity: 0.1,
  }).addTo(map);
  drawCircle.enableEdit();


  // 创建 Explore 按钮
  exploreButton = L.DomUtil.create("button", "explore-btn");
  exploreButton.innerText = "🌿 Explore this area";
  exploreButton.onclick = exploreTreesInCircle;

  const container = map.getContainer();
  container.appendChild(exploreButton);

  map.on('move', updateExploreButtonPosition);
  map.on('zoom', updateExploreButtonPosition);
  drawCircle.on('editable:dragend', updateExploreButtonPosition);
  drawCircle.on('editable:vertex:dragend', updateExploreButtonPosition);

  updateExploreButtonPosition();
}


function updateExploreButtonPosition() {
  if (!drawCircle || !exploreButton) return;

  const centerLatLng = drawCircle.getLatLng();
  const radiusMeters = drawCircle.getRadius();

  // 将圆心的地理位置转为屏幕坐标（像素点）
  const centerPixel = map.latLngToContainerPoint(centerLatLng);

  // 把圆心下方 radius 米的位置也转成像素点
  // 注意这里不能简单加像素，要先算一个 radius 的地理位置点，再转换
  const bottomLatLng = L.GeometryUtil.destination(centerLatLng, 180, radiusMeters);
  const bottomPixel = map.latLngToContainerPoint(bottomLatLng);

  const pixelOffset = bottomPixel.y - centerPixel.y;

  exploreButton.style.left = `${centerPixel.x - 80}px`; // 居中一点
  exploreButton.style.top = `${centerPixel.y + pixelOffset + 10}px`; // 圆下方 + 10px
}


async function exploreTreesInCircle() {
  const loading = document.getElementById("loading-indicator");
  loading.style.display = "block"; // 显示加载提示

  const center = drawCircle.getLatLng();
  const radius = drawCircle.getRadius();
  const data = await fetchAllTrees();

  const inCircle = data.filter(tree => {
    const lat = parseFloat(tree.latitude);
    const lng = parseFloat(tree.longitude);
    if (!lat || !lng) return false;
    const distance = map.distance(center, L.latLng(lat, lng));
    return distance <= radius;
  });

  inCircle.forEach(tree => {
    const category = getTreeCategory(tree.spc_common);
    const marker = L.circleMarker([tree.latitude, tree.longitude], {
      radius: 5,
      fillColor: category.color,
      fillOpacity: 0.8,
      color: 'white',
      weight: 0.8
    }).addTo(map).bindPopup(`
      <div class="popup-card">
        <div class="popup-title">🌳 ${tree.spc_common || "Unknown Tree"}</div>
        <div class="popup-category">a ${category.group}</div>
        <button class="popup-chat-button" onclick="openChat('${tree.tree_id}', '${category.group}')">🌱 Try to Connect</button>
      </div>
    `);
    markerMap[tree.tree_id] = marker;
  });

  loading.style.display = "none"; // 加载完成后隐藏
}





async function fetchAllTrees() {
  let allData = [];
  const boroughs = ["Brooklyn"];

  for (const borough of boroughs) {
    let offset = 0;
    const limit = 1000;
    let moreData = true;

    while (moreData) {
      const response = await fetch(`https://data.cityofnewyork.us/resource/uvpi-gqnh.json?$limit=${limit}&$offset=${offset}&borough=${encodeURIComponent(borough)}`);

      if (!response.ok) {
        console.error(`❌ Fetch failed at offset ${offset} for borough ${borough}`);
        break;
      }

      const data = await response.json();
      const cleanedData = data.map(tree => ({
        tree_id: tree.tree_id,
        spc_common: tree.spc_common,
        latitude: tree.latitude,
        longitude: tree.longitude
      }));

      allData = allData.concat(cleanedData);
      offset += limit;

      if (data.length < limit) {
        moreData = false;
      }
    }
  }

  console.log("🌳 Finished loading trees into memory!");
  return allData;
}




function getTreeCategory(species) {
  const s = (species || "").toLowerCase();

  if (
    s.includes("pine") || s.includes("spruce") || s.includes("fir") ||
    s.includes("cedar") || s.includes("hemlock")
  ) {
    return {
      group: "Evergreen",
      color: "#283618"
    };
  }

  if (
    s.includes("walnut") || s.includes("oak") || s.includes("chestnut") ||
    s.includes("hickory") || s.includes("hazelnut")
  ) {
    return {
      group: "Nut Tree",
      color: "#8B4513"
    };
  }

  if (
    s.includes("cherry") || s.includes("apple") || s.includes("pear") ||
    s.includes("plum") || s.includes("serviceberry")
  ) {
    return {
      group: "Fruiting Tree",
      color: "#FFD700"
    };
  }

  if (
    s.includes("magnolia") || s.includes("redbud") || s.includes("crepe") ||
    s.includes("dogwood") || s.includes("snowbell") || s.includes("fringetree")
  ) {
    return {
      group: "Flowering Only",
      color: "#FF69B4"
    };
  }

  return {
    group: "Deciduous Non-Flowering",
    color: "#90a955"
  };
}


function openChat(id, group) {
  const chatBox = document.getElementById("chat-box");
  const chatLog = document.getElementById("chat-log");
  const chatOptions = document.getElementById("chat-options");

  chatBox.style.display = "block";
  chatLog.innerHTML = "";
  loadChatLog(id, chatLog);

  saveTreeToNetwork(id);
  assignPersonalityIfNeeded(id);
  assignPreferencesIfNeeded(id); // 👈 为当前树初始化喜好

  const personality = getPersonality(id);
  document.getElementById("chat-title").innerHTML = `
    🌿 ${id} 
    <span class="personality-tag" style="background-color:${personality.color};">
      ${personality.type}
    </span>
  `;



  const questions = [{
      text: "Will you blossom?",
      emoji: "🌸/🙅‍♂️"
    },
    {
      text: "Are you thirsty?",
      emoji: "💧/😊"
    },
    {
      text: "Do you like today’s temperature?",
      emoji: "😊/😖"
    },
    {
      text: "Who is your favorite friend?",
      emoji: "🐦/🐿️/🍃/🐱"
    }
  ];

  const shuffled = questions.sort(() => 0.5 - Math.random());
  const selected = shuffled.slice(0, 3);

  chatOptions.innerHTML = "";
  selected.forEach(q => {
    const btn = document.createElement("button");
    btn.className = "chat-option-button";
    btn.innerText = q.emoji;
    btn.style.margin = "3px";
    btn.addEventListener('click', function () {
      respondToQuestion(q.text, group, id);
      this.remove();
    });
    chatOptions.appendChild(btn);
  });
}

function respondToQuestion(question, group, id) {
  const chatLog = document.getElementById("chat-log");
  // 用户发言处
  // timeStamp
  const now = new Date();
  const messageWrapper = document.createElement('div');
  messageWrapper.className = 'message human-message';

  if (shouldShowTimestamp(id, now)) { // 注意加id
    const timeStamp = document.createElement('div');
    timeStamp.className = 'timestamp';
    timeStamp.textContent = formatTime(now);
    messageWrapper.appendChild(timeStamp);
  }

  //  🧍
  const userMsg = document.createElement('p');
  userMsg.className = 'chat-bubble human-res pop-msg';
  userMsg.textContent = `${question}`;
  messageWrapper.appendChild(userMsg);

  chatLog.appendChild(messageWrapper);

  lastMessageTimes[id] = now; // 更新这个tree的lastMessageTime



  // 树回应处
  let response = "🌳 ...";
  if (question.includes("blossom")) {
    response = ["Fruiting Tree", "Nut Tree", "Flowering Only"].includes(group) ? "🌸" : "🙅‍♂️";
  } else if (question.includes("thirsty")) {
    response = Math.random() < 0.4 ? "💧" : "😊";
  }
  const preferences = getPreferences(id);

  if (question.includes("temperature")) {
    response = preferences.likesTemperature ? "😊" : "😖";
  } else if (question.includes("favorite friend")) {
    const emojis = {
      bird: "🐦",
      squirrel: "🐿️",
      leaf: "🍃",
      cat: "🐱"
    };
    const friend = preferences.favoriteFriend;
    response = `${emojis[friend]}!`;
  }



  const personality = getPersonality(id);
  setTimeout(() => {
    const now = new Date();
    const messageWrapper = document.createElement('div');
    messageWrapper.className = 'message tree-message';

    if (shouldShowTimestamp(id, now)) { // 注意加id
      const timeStamp = document.createElement('div');
      timeStamp.className = 'timestamp';
      timeStamp.textContent = formatTime(now);
      messageWrapper.appendChild(timeStamp);
    }

    // 🌳 
    const treeMsg = document.createElement('p');
    treeMsg.className = 'chat-bubble tree-res pop-msg';
    treeMsg.textContent = `${response}`;
    messageWrapper.appendChild(treeMsg);

    chatLog.appendChild(messageWrapper);

    updateChatLog(id, chatLog.innerHTML);
    chatLog.scrollTop = chatLog.scrollHeight;

    lastMessageTimes[id] = now; // 更新这个tree的lastMessageTime
  }, personality.delay);
}

function saveTreeToNetwork(id) {
  let network = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
  if (!network.includes(id)) {
    network.push(id);
    localStorage.setItem("myTreeNetwork", JSON.stringify(network));
  }
}

function loadChatLog(treeId, chatLog) {
  const key = `chat_${treeId}`;
  const savedChat = localStorage.getItem(key);
  if (savedChat) chatLog.innerHTML = savedChat;
}

function updateChatLog(treeId, html) {
  const key = `chat_${treeId}`;
  localStorage.setItem(key, html);
}

function loadMyNetworkTrees() {
  const loading = document.getElementById("loading-indicator");
  loading.style.display = "block"; // 👈 开始加载动画

  fetchAllTrees().then(data => {
    const myTreeIds = JSON.parse(localStorage.getItem("myTreeNetwork")) || [];
    const myTrees = data.filter(tree => myTreeIds.includes(tree.tree_id));
    const positions = [];

    myTrees.forEach(tree => {
      const category = getTreeCategory(tree.spc_common);
      const marker = L.circleMarker([tree.latitude, tree.longitude], {
        radius: 6,
        fillColor: category.color,
        fillOpacity: 0.9,
        color: 'gold',
        weight: 2
      }).addTo(map).bindPopup(`
        <div class="popup-card">
          <div class="popup-title">🌳 ${tree.spc_common || "Unknown Tree"}</div>
          <div class="popup-category">a ${category.group}</div>
          <button class="popup-chat-button" onclick="openChat('${tree.tree_id}', '${category.group}')">🌱 Try to Connect</button>
        </div>
      `);
      markerMap[tree.tree_id] = marker;

      const latlng = marker.getLatLng();
      positions.push([latlng.lat, latlng.lng]);
    });

    if (positions.length > 1) {
      networkLine = L.polyline(positions, {
        color: "green",
        weight: 3,
        opacity: 0.7,
        dashArray: "8, 5"
      }).addTo(map);
      // map.fitBounds(networkLine.getBounds());
    } else {
      alert("你至少需要联系两棵树才会画线！");
    }
    loading.style.display = "none"; // 👈 加载结束隐藏动画
  });
}

function assignPersonalityIfNeeded(id) {
  const key = `personality_${id}`;
  if (!localStorage.getItem(key)) {
    const randomPersonality = personalities[Math.floor(Math.random() * personalities.length)];
    localStorage.setItem(key, JSON.stringify(randomPersonality));
  }
}

function getPersonality(id) {
  const key = `personality_${id}`;
  const saved = localStorage.getItem(key);
  if (saved) {
    return JSON.parse(saved);
  }
  return {
    type: "Calm",
    delay: 1500
  }; // 默认给个性格
}

function assignPreferencesIfNeeded(id) {
  const key = `preferences_${id}`;
  if (!localStorage.getItem(key)) {
    const randomPreference = {
      likesTemperature: Math.random() < 0.5, // true or false
      favoriteFriend: ["bird", "squirrel", "leaf", "cat"][Math.floor(Math.random() * 4)]
    };
    localStorage.setItem(key, JSON.stringify(randomPreference));
  }
}

function getPreferences(id) {
  const key = `preferences_${id}`;
  const saved = localStorage.getItem(key);
  if (saved) return JSON.parse(saved);
  return {
    likesTemperature: true,
    favoriteFriend: "bird"
  };
}


function shouldShowTimestamp(treeId, now) {
  const lastTime = lastMessageTimes[treeId];
  if (!lastTime) return true;
  const diff = now - lastTime; // 毫秒差
  return diff > 2 * 60 * 1000; // 大于2分钟
}


function formatTime(date) {
  const now = new Date();

  // 计算是不是今天
  const isToday = date.toDateString() === now.toDateString();

  // 判断是不是昨天
  const yesterday = new Date();
  yesterday.setDate(now.getDate() - 1);
  const isYesterday = date.toDateString() === yesterday.toDateString();

  const hour = date.getHours().toString().padStart(2, '0');
  const minute = date.getMinutes().toString().padStart(2, '0');

  if (isToday) {
    return `${hour}:${minute}`;
  } else if (isYesterday) {
    return `Yesterday ${hour}:${minute}`;
  } else {
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const day = date.getDate().toString().padStart(2, '0');
    return `${month}-${day} ${hour}:${minute}`;
  }
}


// 🌱 背景自动预加载树数据
// (async () => {
//   if (!localStorage.getItem("treeCache")) {
//     console.log("🌍 Preloading tree data...");
//     await fetchAllTrees();
//     console.log("✅ Tree data loaded and cached.");
//   } else {
//     console.log("📦 Tree data already in cache.");
//   }
// })();