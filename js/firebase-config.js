// 把這裡換成你自己 Firebase 專案的設定值，才能讓「主持端」和「報到回報端」
// 在不同裝置之間即時同步資料。
//
// 取得方式：
// 1. 到 https://console.firebase.google.com/ 建立一個新專案（免費方案即可）。
// 2. 左側選單「建構」→「Realtime Database」→建立資料庫（測試模式即可，見 README 的安全性規則）。
// 3. 左側「專案設定」→「一般」→ 在「您的應用程式」新增一個「網頁應用程式」。
// 4. 把畫面上出現的 firebaseConfig 物件內容貼到下面。
//
// 在還沒填之前（維持 "YOUR_API_KEY"），程式會自動切換成「本機測試模式」，
// 只能在同一台電腦、同一個瀏覽器的不同分頁之間同步，方便你先測試介面。
window.firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  databaseURL: "https://YOUR_PROJECT-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "000000000000",
  appId: "1:000000000000:web:xxxxxxxxxxxxxxxxxxxxxx"
};
