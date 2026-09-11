importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.7.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBQMMU8S1KWDNceb-GUi79QlOOFrKhXPzo",
  authDomain: "aditracker-6ac11.firebaseapp.com",
  projectId: "aditracker-6ac11",
  messagingSenderId: "318988643925",
  appId: "1:318988643925:web:28fbfd44b7320d74b06edc"
});

const messaging = firebase.messaging();
messaging.onBackgroundMessage((payload) => {
  self.registration.showNotification(payload.notification.title, {
    body: payload.notification.body,
    icon: '/icon-192.png'
  });
});