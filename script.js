// script.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore, collection, doc, setDoc, getDoc, getDocs, addDoc, updateDoc, deleteDoc, query, where, orderBy, onSnapshot, serverTimestamp, arrayUnion, arrayRemove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage, ref, uploadBytesResumable, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";
import { firebaseConfig } from './firebase-config.js';

// تهيئة Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

// إعدادات Cloudinary
const CLOUDINARY_CLOUD_NAME = "dnillsbmi";
const CLOUDINARY_UPLOAD_PRESET = "ekxzvogb";

// متغيرات عامة
let currentUser = null;
let currentChatId = null;
let currentChatType = null;
let unsubscribeMessages = null;
let unsubscribeChats = null;
let usersCache = new Map();
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;

// عناصر DOM
const authScreen = document.getElementById('authScreen');
const appContainer = document.getElementById('appContainer');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const submitBtn = document.getElementById('submitBtn');
const toggleAuthBtn = document.getElementById('toggleAuthBtn');
const authTitle = document.getElementById('authTitle');
const userNameSpan = document.getElementById('userName');
const logoutBtn = document.getElementById('logoutBtn');
const chatsListDiv = document.getElementById('chatsList');
const chatNameSpan = document.getElementById('chatName');
const chatAvatarDiv = document.getElementById('chatAvatar');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const fileInput = document.getElementById('fileInput');
const backBtn = document.getElementById('backBtn');
const searchUserInput = document.getElementById('searchUserInput');
const startChatBtn = document.getElementById('startChatBtn');
const createGroupBtn = document.getElementById('createGroupBtn');
const fileLabel = document.getElementById('fileLabel');
const darkModeToggle = document.getElementById('darkModeToggle');
const searchMsgBtn = document.getElementById('searchMsgBtn');
const voiceRecordBtn = document.getElementById('voiceRecordBtn');
const adminToggleBtn = document.getElementById('adminToggleBtn');
const adminPanel = document.getElementById('adminPanel');
const closeAdminBtn = document.getElementById('closeAdminBtn');

// ========== المصادقة ==========
let isLoginMode = true;

toggleAuthBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        authTitle.innerText = 'تسجيل الدخول';
        submitBtn.innerText = 'دخول';
        toggleAuthBtn.innerText = 'إنشاء حساب جديد';
    } else {
        authTitle.innerText = 'إنشاء حساب';
        submitBtn.innerText = 'إنشاء';
        toggleAuthBtn.innerText = 'لديك حساب؟ سجل دخول';
    }
});

submitBtn.addEventListener('click', async () => {
    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();
    if (!email || !password) {
        alert('يرجى ملء البريد وكلمة المرور');
        return;
    }
    try {
        if (isLoginMode) {
            await signInWithEmailAndPassword(auth, email, password);
        } else {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            await setDoc(doc(db, 'users', userCred.user.uid), {
                uid: userCred.user.uid,
                email: email,
                displayName: email.split('@')[0],
                createdAt: serverTimestamp(),
                banned: false
            });
        }
    } catch (error) {
        alert('خطأ: ' + error.message);
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        const userDoc = await getDoc(doc(db, 'users', user.uid));
        if (userDoc.exists() && userDoc.data().banned) {
            alert('تم حظر حسابك. تواصل مع المسؤول.');
            await signOut(auth);
            return;
        }
        if (userDoc.exists()) {
            userNameSpan.innerText = userDoc.data().displayName || user.email;
        } else {
            userNameSpan.innerText = user.email;
        }
        authScreen.style.display = 'none';
        appContainer.style.display = 'flex';
        loadChats();
        
        // إظهار زر لوحة التحكم للمسؤول
        if (user.email === 'jasim28v@gmail.com') {
            adminToggleBtn.style.display = 'flex';
            loadAdminPanel();
        } else {
            adminToggleBtn.style.display = 'none';
        }
    } else {
        currentUser = null;
        authScreen.style.display = 'flex';
        appContainer.style.display = 'none';
        if (unsubscribeChats) unsubscribeChats();
        if (unsubscribeMessages) unsubscribeMessages();
        chatsListDiv.innerHTML = '';
        messagesContainer.innerHTML = '';
        currentChatId = null;
        adminToggleBtn.style.display = 'none';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// ========== قائمة المحادثات ==========
async function loadChats() {
    if (!currentUser) return;
    const chatsRef = collection(db, 'chats');
    const q = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    unsubscribeChats = onSnapshot(q, async (snapshot) => {
        chatsListDiv.innerHTML = '';
        const chats = [];
        for (const docSnap of snapshot.docs) {
            const chat = { id: docSnap.id, ...docSnap.data() };
            chats.push(chat);
        }
        chats.sort((a,b) => (b.lastMessageTime?.seconds || 0) - (a.lastMessageTime?.seconds || 0));
        
        for (const chat of chats) {
            const chatName = await getChatName(chat);
            const lastMsg = chat.lastMessageText || '';
            const div = document.createElement('div');
            div.className = 'chat-item' + (currentChatId === chat.id ? ' active' : '');
            div.setAttribute('data-chat-id', chat.id);
            div.setAttribute('data-chat-type', chat.type);
            div.innerHTML = `
                <div class="chat-avatar">${chatName.charAt(0)}</div>
                <div class="chat-details">
                    <div class="chat-name">${escapeHtml(chatName)}</div>
                    <div class="chat-last-msg">${escapeHtml(lastMsg.substring(0, 30))}</div>
                </div>
            `;
            div.addEventListener('click', () => openChat(chat.id, chat.type, chatName));
            chatsListDiv.appendChild(div);
        }
        if (chatsListDiv.children.length === 0) {
            chatsListDiv.innerHTML = '<div style="padding:20px; text-align:center;">لا توجد محادثات بعد</div>';
        }
    });
}

async function getChatName(chat) {
    if (chat.type === 'group') return chat.groupName;
    const otherId = chat.participants.find(pid => pid !== currentUser.uid);
    if (!otherId) return 'مستخدم غير معروف';
    if (usersCache.has(otherId)) return usersCache.get(otherId).displayName;
    const userDoc = await getDoc(doc(db, 'users', otherId));
    if (userDoc.exists()) {
        const name = userDoc.data().displayName || userDoc.data().email;
        usersCache.set(otherId, { displayName: name });
        return name;
    }
    return 'غير معروف';
}

// ========== فتح محادثة ==========
async function openChat(chatId, type, name) {
    if (unsubscribeMessages) unsubscribeMessages();
    currentChatId = chatId;
    currentChatType = type;
    chatNameSpan.innerText = name;
    chatAvatarDiv.innerText = name.charAt(0);
    messagesContainer.innerHTML = '';
    const messagesRef = collection(db, 'chats', chatId, 'messages');
    const q = query(messagesRef, orderBy('timestamp', 'asc'));
    unsubscribeMessages = onSnapshot(q, (snapshot) => {
        messagesContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            displayMessage(msg, docSnap.id);
        });
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    });
    document.querySelectorAll('.chat-item').forEach(el => {
        if (el.getAttribute('data-chat-id') === chatId) {
            el.classList.add('active');
        } else {
            el.classList.remove('active');
        }
    });
    if (window.innerWidth <= 768) {
        document.getElementById('chatsSidebar').classList.add('hide');
    }
}

backBtn.addEventListener('click', () => {
    if (window.innerWidth <= 768) {
        document.getElementById('chatsSidebar').classList.remove('hide');
    }
});

// ========== عرض الرسالة ==========
function displayMessage(msg, msgId) {
    const div = document.createElement('div');
    div.className = 'message ' + (msg.senderId === currentUser.uid ? 'sent' : 'received');
    let content = '';
    if (msg.replyTo) {
        content += `<div style="background:rgba(255,255,255,0.1); padding:4px 8px; border-radius:12px; margin-bottom:4px; font-size:0.8rem;">↩️ ${escapeHtml(msg.replyTo.text.substring(0,50))}</div>`;
    }
    if (msg.text) {
        content += `<div>${escapeHtml(msg.text)}</div>`;
    }
    if (msg.imageUrl) {
        content += `<img src="${msg.imageUrl}" alt="صورة" onclick="window.open('${msg.imageUrl}','_blank')">`;
    }
    if (msg.voiceUrl) {
        content += `<audio controls src="${msg.voiceUrl}" style="max-width:200px;"></audio>`;
    }
    const time = msg.timestamp ? new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '';
    content += `<div class="message-time">${time}</div>`;
    if (msg.senderId === currentUser.uid) {
        content += `<div style="text-align:left; margin-top:4px;">
            <button class="edit-msg" data-id="${msgId}" data-text="${escapeHtml(msg.text || '')}" style="background:none; border:none; color:#aaa; cursor:pointer;"><i class="fas fa-edit"></i></button>
            <button class="delete-msg" data-id="${msgId}" style="background:none; border:none; color:#aaa; cursor:pointer;"><i class="fas fa-trash"></i></button>
            <button class="reply-msg" data-id="${msgId}" data-text="${escapeHtml(msg.text || 'صورة')}" style="background:none; border:none; color:#aaa; cursor:pointer;"><i class="fas fa-reply"></i></button>
        </div>`;
    } else {
        content += `<div style="text-align:left; margin-top:4px;">
            <button class="reply-msg" data-id="${msgId}" data-text="${escapeHtml(msg.text || 'صورة')}" style="background:none; border:none; color:#aaa; cursor:pointer;"><i class="fas fa-reply"></i></button>
        </div>`;
    }
    div.innerHTML = content;
    messagesContainer.appendChild(div);
    
    // إضافة مستمعات للأزرار
    div.querySelectorAll('.edit-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const msgId = btn.dataset.id;
            const oldText = btn.dataset.text;
            const newText = prompt('تحرير الرسالة:', oldText);
            if (newText && newText !== oldText) editMessage(currentChatId, msgId, newText);
        });
    });
    div.querySelectorAll('.delete-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (confirm('حذف الرسالة؟')) deleteMessage(currentChatId, btn.dataset.id);
        });
    });
    div.querySelectorAll('.reply-msg').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const replyText = btn.dataset.text;
            messageInput.dataset.replyTo = btn.dataset.id;
            messageInput.dataset.replyText = replyText;
            messageInput.placeholder = `رد على: ${replyText.substring(0,30)}...`;
            messageInput.focus();
        });
    });
}

function escapeHtml(str) {
    if (!str) return '';
    return str.replace(/[&<>]/g, function(m) {
        if (m === '&') return '&amp;';
        if (m === '<') return '&lt;';
        if (m === '>') return '&gt;';
        return m;
    });
}

// ========== إرسال رسالة (نص، صورة، صوت) ==========
sendBtn.addEventListener('click', sendMessage);
messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendMessage();
});

async function sendMessage() {
    if (!currentChatId) return;
    const text = messageInput.value.trim();
    if (!text && !fileInput.files.length && !audioChunks.length) return;
    
    const messageData = {
        senderId: currentUser.uid,
        timestamp: serverTimestamp(),
        text: text || null
    };
    
    if (messageInput.dataset.replyTo) {
        messageData.replyTo = {
            id: messageInput.dataset.replyTo,
            text: messageInput.dataset.replyText
        };
        delete messageInput.dataset.replyTo;
        delete messageInput.dataset.replyText;
        messageInput.placeholder = 'اكتب رسالة...';
    }
    
    if (fileInput.files.length) {
        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        
        try {
            const response = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`, {
                method: 'POST',
                body: formData
            });
            const data = await response.json();
            if (data.secure_url) {
                messageData.imageUrl = data.secure_url;
                await addDoc(collection(db, 'chats', currentChatId, 'messages'), messageData);
                await updateDoc(doc(db, 'chats', currentChatId), {
                    lastMessageText: text || '📷 صورة',
                    lastMessageTime: serverTimestamp()
                });
                fileInput.value = '';
            } else {
                throw new Error('فشل رفع الصورة');
            }
        } catch (error) {
            console.error(error);
            alert('حدث خطأ أثناء رفع الصورة. تأكد من إعدادات Cloudinary.');
        }
    } 
    else if (audioChunks.length) {
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        const storageRef = ref(storage, `voice/${currentChatId}/${Date.now()}.webm`);
        const uploadTask = uploadBytesResumable(storageRef, audioBlob);
        uploadTask.on('state_changed', null, (error) => console.error(error), async () => {
            const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
            messageData.voiceUrl = downloadURL;
            await addDoc(collection(db, 'chats', currentChatId, 'messages'), messageData);
            await updateDoc(doc(db, 'chats', currentChatId), {
                lastMessageText: text || '🎤 رسالة صوتية',
                lastMessageTime: serverTimestamp()
            });
            audioChunks = [];
            voiceRecordBtn.innerHTML = '<i class="fas fa-microphone"></i>';
            isRecording = false;
        });
    }
    else {
        await addDoc(collection(db, 'chats', currentChatId, 'messages'), messageData);
        await updateDoc(doc(db, 'chats', currentChatId), {
            lastMessageText: text,
            lastMessageTime: serverTimestamp()
        });
    }
    messageInput.value = '';
}

// ========== تحرير وحذف الرسائل ==========
async function editMessage(chatId, messageId, newText) {
    await updateDoc(doc(db, 'chats', chatId, 'messages', messageId), {
        text: newText,
        edited: true
    });
}
async function deleteMessage(chatId, messageId) {
    await deleteDoc(doc(db, 'chats', chatId, 'messages', messageId));
}

// ========== تسجيل الصوت ==========
voiceRecordBtn.addEventListener('click', async () => {
    if (!currentChatId) return alert('افتح محادثة أولاً');
    if (!isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream);
            audioChunks = [];
            mediaRecorder.ondataavailable = event => audioChunks.push(event.data);
            mediaRecorder.onstop = () => {
                sendMessage();
                stream.getTracks().forEach(track => track.stop());
            };
            mediaRecorder.start();
            isRecording = true;
            voiceRecordBtn.innerHTML = '<i class="fas fa-stop"></i>';
        } catch (err) {
            alert('لا يمكن الوصول إلى الميكروفون');
        }
    } else {
        mediaRecorder.stop();
    }
});

// ========== البحث في الرسائل ==========
searchMsgBtn.addEventListener('click', async () => {
    if (!currentChatId) return alert('افتح محادثة أولاً');
    const term = prompt('أدخل نص البحث:');
    if (!term) return;
    const messagesRef = collection(db, 'chats', currentChatId, 'messages');
    const q = query(messagesRef, where('text', '>=', term), where('text', '<=', term + '\uf8ff'));
    const snapshot = await getDocs(q);
    messagesContainer.innerHTML = '';
    snapshot.forEach(docSnap => displayMessage(docSnap.data(), docSnap.id));
    if (snapshot.empty) messagesContainer.innerHTML = '<div style="text-align:center;">لا توجد نتائج</div>';
});

// ========== إدارة المجموعات (إضافة أعضاء) ==========
async function addMemberToGroup(groupId, memberEmail) {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', memberEmail));
    const snap = await getDocs(q);
    if (snap.empty) return alert('المستخدم غير موجود');
    const memberId = snap.docs[0].id;
    await updateDoc(doc(db, 'chats', groupId), {
        participants: arrayUnion(memberId)
    });
    alert('تمت الإضافة');
}

// رابط دعوة للمجموعة (بسيط)
function generateInviteLink(groupId) {
    const link = `${window.location.origin}?invite=${groupId}`;
    prompt('رابط الدعوة:', link);
}

// ========== معاينة الروابط (مبسطة) ==========
// يمكن إضافة مكتبة خارجية لكن سنكتفي بتنبيه بسيط

// ========== الوضع المظلم ==========
darkModeToggle.addEventListener('click', () => {
    document.body.classList.toggle('light-mode');
    localStorage.setItem('theme', document.body.classList.contains('light-mode') ? 'light' : 'dark');
});
if (localStorage.getItem('theme') === 'light') document.body.classList.add('light-mode');

// ========== بدء محادثة فردية ==========
startChatBtn.addEventListener('click', async () => {
    const email = searchUserInput.value.trim();
    if (!email) return alert('أدخل البريد الإلكتروني للمستخدم');
    if (email === currentUser.email) return alert('لا يمكن بدء محادثة مع نفسك');
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
        alert('لم يتم العثور على مستخدم بهذا البريد');
        return;
    }
    const otherUser = querySnapshot.docs[0];
    const otherId = otherUser.id;
    
    const chatsRef = collection(db, 'chats');
    const existingQuery = query(chatsRef, where('participants', 'array-contains', currentUser.uid));
    const existingSnap = await getDocs(existingQuery);
    let existingChat = null;
    existingSnap.forEach(docSnap => {
        const data = docSnap.data();
        if (data.type === 'private' && data.participants.includes(otherId)) {
            existingChat = { id: docSnap.id, ...data };
        }
    });
    
    if (existingChat) {
        openChat(existingChat.id, 'private', otherUser.data().displayName || email);
    } else {
        const chatRef = await addDoc(collection(db, 'chats'), {
            type: 'private',
            participants: [currentUser.uid, otherId],
            createdAt: serverTimestamp()
        });
        openChat(chatRef.id, 'private', otherUser.data().displayName || email);
    }
    searchUserInput.value = '';
});

// ========== إنشاء مجموعة ==========
createGroupBtn.addEventListener('click', async () => {
    const groupName = prompt('أدخل اسم المجموعة:');
    if (!groupName) return;
    const chatRef = await addDoc(collection(db, 'chats'), {
        type: 'group',
        groupName: groupName,
        participants: [currentUser.uid],
        createdBy: currentUser.uid,
        createdAt: serverTimestamp()
    });
    openChat(chatRef.id, 'group', groupName);
    // عرض خيار إضافة أعضاء وإدارة المجموعة
    setTimeout(() => {
        if (confirm('هل تريد إضافة أعضاء للمجموعة الآن؟')) {
            const email = prompt('أدخل البريد الإلكتروني للعضو الجديد:');
            if (email) addMemberToGroup(chatRef.id, email);
        }
        if (confirm('هل تريد إنشاء رابط دعوة للمجموعة؟')) {
            generateInviteLink(chatRef.id);
        }
    }, 500);
});

// ========== رفع الصور ==========
fileLabel.addEventListener('click', () => fileInput.click());

// ========== لوحة التحكم ==========
async function loadAdminPanel() {
    const adminContent = document.getElementById('adminContent');
    adminContent.innerHTML = '<div>جاري تحميل المستخدمين...</div>';
    
    const usersSnapshot = await getDocs(collection(db, 'users'));
    let usersList = '<h4>المستخدمون</h4>';
    usersSnapshot.forEach(docSnap => {
        const user = docSnap.data();
        usersList += `
            <div class="user-item">
                <span>${user.email}</span>
                <div>
                    <button onclick="window.banUser('${docSnap.id}')" class="ban-btn">حظر</button>
                    <button onclick="window.deleteUserAccount('${docSnap.id}')" class="delete-btn">حذف</button>
                </div>
            </div>
        `;
    });
    const chatsSnapshot = await getDocs(collection(db, 'chats'));
    let messagesCount = 0;
    for (const chatDoc of chatsSnapshot.docs) {
        const msgsSnap = await getDocs(collection(db, 'chats', chatDoc.id, 'messages'));
        messagesCount += msgsSnap.size;
    }
    adminContent.innerHTML = usersList + `<p>عدد المحادثات: ${chatsSnapshot.size}</p><p>عدد الرسائل: ${messagesCount}</p>`;
}

window.banUser = async (uid) => {
    if (confirm('حظر هذا المستخدم؟')) {
        await updateDoc(doc(db, 'users', uid), { banned: true });
        alert('تم الحظر');
        loadAdminPanel();
    }
};
window.deleteUserAccount = async (uid) => {
    if (confirm('حذف هذا المستخدم وجميع بياناته؟')) {
        await deleteDoc(doc(db, 'users', uid));
        const chatsRef = collection(db, 'chats');
        const q = query(chatsRef, where('participants', 'array-contains', uid));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (docSnap) => {
            await deleteDoc(doc(db, 'chats', docSnap.id));
        });
        alert('تم الحذف');
        loadAdminPanel();
    }
};

adminToggleBtn.addEventListener('click', () => {
    adminPanel.classList.toggle('open');
});
closeAdminBtn.addEventListener('click', () => {
    adminPanel.classList.remove('open');
});

// ========== تصدير البيانات (نسخ احتياطي) ==========
function exportUserData() {
    // تصدير محادثات المستخدم إلى JSON
    alert('سيتم تصدير بياناتك قريباً');
}
