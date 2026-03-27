// ========== إعدادات الأدمن ==========
const ADMIN_EMAILS = ['jasim28v@gmail.com'];
let isAdmin = false;

// ========== المتغيرات العامة ==========
let currentUser = null;
let currentUserData = null;
let currentVideoId = null;
let currentShareUrl = null;
let allUsers = {};
let allVideos = [];
let allSounds = {};
let isMuted = true;
let viewingProfileUserId = null;
let currentFeed = 'forYou';
let currentStoryList = [];
let currentStoryIndex = 0;
let storyTimer = null;
let watchLaterList = [];
let currentReplyToCommentId = null;
let mediaRecorder = null;
let recordedChunks = [];

// ========== دوال المصادقة ==========
function switchAuth(type) {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    event.target.classList.add('active');
    document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
    document.getElementById(type + 'Form').classList.add('active');
}

async function login() {
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    const msg = document.getElementById('loginMsg');
    if (!email || !password) { msg.innerText = 'الرجاء ملء جميع الحقول'; return; }
    msg.innerText = 'جاري تسجيل الدخول...';
    try {
        await auth.signInWithEmailAndPassword(email, password);
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/user-not-found') msg.innerText = 'لا يوجد حساب';
        else if (error.code === 'auth/wrong-password') msg.innerText = 'كلمة المرور غير صحيحة';
        else msg.innerText = 'حدث خطأ';
    }
}

async function register() {
    const username = document.getElementById('regName').value;
    const email = document.getElementById('regEmail').value;
    const password = document.getElementById('regPass').value;
    const msg = document.getElementById('regMsg');
    if (!username || !email || !password) { msg.innerText = 'املأ جميع الحقول'; return; }
    if (password.length < 6) { msg.innerText = 'كلمة المرور 6 أحرف على الأقل'; return; }
    msg.innerText = 'جاري إنشاء الحساب...';
    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await db.ref(`users/${userCredential.user.uid}`).set({
            username, email, bio: '', avatarUrl: '', followers: {}, following: {}, totalLikes: 0, createdAt: Date.now()
        });
        msg.innerText = '';
    } catch (error) {
        if (error.code === 'auth/email-already-in-use') msg.innerText = 'البريد مستخدم';
        else msg.innerText = 'حدث خطأ';
    }
}

function logout() { auth.signOut(); location.reload(); }

// ========== التحقق من الأدمن ==========
function checkAdminStatus() {
    if (currentUser && ADMIN_EMAILS.includes(currentUser.email)) {
        isAdmin = true;
        console.log('✅ Admin mode activated for:', currentUser.email);
        return true;
    }
    isAdmin = false;
    return false;
}

// ========== دوال الأدمن ==========
async function renderAdminPanel() {
    if (!isAdmin) return '';
    const usersSnap = await db.ref('users').once('value');
    const users = usersSnap.val() || {};
    const videosSnap = await db.ref('videos').once('value');
    const videos = videosSnap.val() || {};
    const totalLikes = Object.values(videos).reduce((sum, v) => sum + (v.likes || 0), 0);
    const bannedUsers = Object.values(users).filter(u => u.banned).length;
    return `
        <div class="admin-panel-section">
            <h3 style="color:#fe2c55;font-weight:bold;margin-bottom:16px;display:flex;align-items:center;gap:8px"><i class="fas fa-shield-alt"></i> لوحة تحكم الأدمن</h3>
            <div class="admin-stats">
                <div class="admin-stat-card"><div class="admin-stat-number">${Object.keys(users).length}</div><div class="admin-stat-label">مستخدمين</div></div>
                <div class="admin-stat-card"><div class="admin-stat-number">${Object.keys(videos).length}</div><div class="admin-stat-label">فيديوهات</div></div>
                <div class="admin-stat-card"><div class="admin-stat-number">${totalLikes}</div><div class="admin-stat-label">إجمالي الإعجابات</div></div>
                <div class="admin-stat-card"><div class="admin-stat-number">${bannedUsers}</div><div class="admin-stat-label">محظورين</div></div>
            </div>
            <div style="margin-bottom:20px"><h4 style="font-weight:bold;margin-bottom:12px">🗑️ حذف فيديوهات</h4><div class="admin-list">${Object.entries(videos).reverse().slice(0, 15).map(([id, v]) => `
                <div class="admin-item"><div class="admin-item-info"><div class="admin-item-avatar"><i class="fas fa-video"></i></div><div class="admin-item-text"><div class="admin-item-name">${v.description?.substring(0, 35) || 'فيديو'}</div><div class="admin-item-email">@${v.senderName || 'user'}</div></div></div><button class="admin-delete-btn" onclick="adminDeleteVideo('${id}')">حذف</button></div>
            `).join('')}</div>${Object.keys(videos).length > 15 ? `<p class="text-center text-xs opacity-60 mt-2">+${Object.keys(videos).length - 15} فيديو آخر</p>` : ''}</div>
            <div><h4 style="font-weight:bold;margin-bottom:12px">👥 إدارة المستخدمين</h4><div class="admin-list">${Object.entries(users).slice(0, 15).map(([uid, u]) => `
                <div class="admin-item"><div class="admin-item-info"><div class="admin-item-avatar">${u.avatarUrl ? `<img src="${u.avatarUrl}">` : (u.username?.charAt(0) || 'U')}</div><div class="admin-item-text"><div class="admin-item-name">@${u.username} ${u.banned ? '<span style="background:#fe2c55;padding:2px 6px;border-radius:12px;font-size:9px;margin-left:5px">محظور</span>' : ''}</div><div class="admin-item-email">${u.email || ''}</div></div></div><div>${!u.banned ? `<button class="admin-ban-btn" onclick="adminBanUser('${uid}')">حظر</button>` : `<button class="admin-ban-btn" style="background:rgba(76,175,80,0.3);color:#4caf50" onclick="adminUnbanUser('${uid}')">إلغاء الحظر</button>`}<button class="admin-delete-btn" onclick="adminDeleteUser('${uid}')">حذف</button></div></div>
            `).join('')}</div></div>
            <div><h4 style="font-weight:bold;margin-bottom:12px">📊 إحصائيات متقدمة</h4><div class="admin-list">${renderAdminStats(videos, users)}</div></div>
            <div><h4 style="font-weight:bold;margin-bottom:12px">🚨 التقارير</h4><button class="admin-ban-btn" onclick="openReports()">عرض التقارير</button></div>
        </div>
    `;
}

function renderAdminStats(videos, users) {
    // أكثر فيديوهات إعجاباً
    const topVideos = Object.entries(videos).sort((a,b) => (b[1].likes||0) - (a[1].likes||0)).slice(0,5);
    const topUsers = Object.entries(users).sort((a,b) => (Object.keys(b[1].followers||{}).length) - (Object.keys(a[1].followers||{}).length)).slice(0,5);
    return `
        <div><strong>🎬 أكثر فيديوهات إعجاباً:</strong> ${topVideos.map(v => `<div>${v[1].description?.substring(0,20)} (${v[1].likes||0} ❤️)</div>`).join('')}</div>
        <div class="mt-2"><strong>👑 أكثر المستخدمين متابعة:</strong> ${topUsers.map(u => `<div>@${u[1].username} (${Object.keys(u[1].followers||{}).length} متابع)</div>`).join('')}</div>
    `;
}

async function adminDeleteVideo(videoId) { if (!isAdmin) return; if (confirm('حذف الفيديو؟')) { await db.ref(`videos/${videoId}`).remove(); alert('✅ تم الحذف'); location.reload(); } }
async function adminBanUser(userId) { if (!isAdmin) return; if (confirm('حظر المستخدم؟')) { await db.ref(`users/${userId}/banned`).set(true); alert('✅ تم الحظر'); location.reload(); } }
async function adminUnbanUser(userId) { if (!isAdmin) return; if (confirm('إلغاء الحظر؟')) { await db.ref(`users/${userId}/banned`).remove(); alert('✅ تم إلغاء الحظر'); location.reload(); } }
async function adminDeleteUser(userId) { if (!isAdmin) return; if (confirm('حذف المستخدم وجميع فيديوهاته؟')) { const videosSnap = await db.ref('videos').once('value'); const videos = videosSnap.val() || {}; Object.entries(videos).forEach(([id, v]) => { if (v.sender === userId) db.ref(`videos/${id}`).remove(); }); await db.ref(`users/${userId}`).remove(); alert('✅ تم الحذف'); location.reload(); } }

// ========== تحميل البيانات ==========
async function loadUserData() { const snap = await db.ref(`users/${currentUser.uid}`).get(); if (snap.exists()) currentUserData = { uid: currentUser.uid, ...snap.val() }; }
db.ref('users').on('value', s => { allUsers = s.val() || {}; });

// ========== هاشتاقات ==========
function addHashtags(text) { if (!text) return ''; return text.replace(/#(\w+)/g, '<span class="hashtag" onclick="searchHashtag(\'$1\')">#$1</span>'); }
function searchHashtag(tag) { document.getElementById('searchInput').value = '#' + tag; openSearch(); searchAll(); }

// ========== عرض الفيديوهات ==========
db.ref('videos').on('value', (s) => {
    const data = s.val();
    if (!data) { allVideos = []; renderVideos(); return; }
    allVideos = []; allSounds = {};
    Object.keys(data).forEach(key => { const v = { id: key, ...data[key] }; allVideos.push(v); if (v.music) allSounds[v.music] = (allSounds[v.music] || 0) + 1; });
    allVideos.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
    renderVideos(); renderSoundsList(); loadTrending(); loadExploreVideos();
});

function renderVideos() {
    const container = document.getElementById('videosContainer'); if (!container) return;
    container.innerHTML = '';
    let filteredVideos = currentFeed === 'forYou' ? allVideos : allVideos.filter(v => currentUserData?.following?.[v.sender]);
    if (filteredVideos.length === 0) { container.innerHTML = '<div class="loading"><div class="spinner"></div><span>' + (currentFeed === 'forYou' ? 'لا توجد فيديوهات' : 'تابع مستخدمين لرؤية فيديوهاتهم') + '</span></div>'; return; }
    filteredVideos.forEach(video => {
        const isLiked = video.likedBy && video.likedBy[currentUser?.uid];
        const user = allUsers[video.sender] || { username: video.senderName || 'user', avatarUrl: '' };
        const isFollowing = currentUserData?.following && currentUserData.following[video.sender];
        const commentsCount = video.comments ? Object.keys(video.comments).length : 0;
        const caption = addHashtags(video.description || '');
        const avatarHtml = (user.avatarUrl && user.avatarUrl !== '') ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0)?.toUpperCase() || '👤');
        const isSaved = watchLaterList.includes(video.id);
        const div = document.createElement('div'); div.className = 'video-item';
        div.innerHTML = `
            <video loop playsinline muted data-src="${video.url}" poster="${video.thumbnail || ''}"></video>
            <div class="video-info">
                <div class="author-info"><div class="author-avatar" onclick="viewProfile('${video.sender}')">${avatarHtml}</div><div class="author-name"><span onclick="viewProfile('${video.sender}')">@${user.username}</span>${currentUser?.uid !== video.sender ? `<button class="follow-btn" onclick="toggleFollow('${video.sender}', this)">${isFollowing ? 'متابع' : 'متابعة'}</button>` : ''}</div></div>
                <div class="video-caption">${caption}</div>
                <div class="video-music" onclick="searchBySound('${video.music || 'Original Sound'}')"><i class="fas fa-music"></i> ${video.music || 'Original Sound'}</div>
            </div>
            <div class="side-actions">
                <button class="side-btn" onclick="toggleGlobalMute()"><i class="fas ${isMuted ? 'fa-volume-mute' : 'fa-volume-up'}"></i></button>
                <button class="side-btn like-btn ${isLiked ? 'active' : ''}" onclick="toggleLike('${video.id}', this)"><i class="fas fa-heart"></i><span class="count">${video.likes || 0}</span></button>
                <button class="side-btn" onclick="openComments('${video.id}')"><i class="fas fa-comment"></i><span class="count">${commentsCount}</span></button>
                <button class="side-btn watchlater-btn ${isSaved ? 'active' : ''}" onclick="toggleWatchLater('${video.id}', this)"><i class="fas fa-clock"></i></button>
                <button class="side-btn" onclick="openShare('${video.url}')"><i class="fas fa-share"></i></button>
                <button class="side-btn" onclick="reportVideo('${video.id}')"><i class="fas fa-flag"></i></button>
            </div>
        `;
        const videoEl = div.querySelector('video');
        videoEl.addEventListener('dblclick', (e) => { e.stopPropagation(); const likeBtn = div.querySelector('.like-btn'); if (likeBtn) { toggleLike(video.id, likeBtn); showHeartAnimation(e.clientX, e.clientY); playClickSound(); } });
        container.appendChild(div);
    });
    initVideoObserver();
}
function showHeartAnimation(x, y) { const heart = document.createElement('div'); heart.className = 'heart-animation'; heart.innerHTML = '❤️'; heart.style.left = (x - 40) + 'px'; heart.style.top = (y - 40) + 'px'; document.body.appendChild(heart); setTimeout(() => heart.remove(), 800); }
function initVideoObserver() { const observer = new IntersectionObserver((entries) => { entries.forEach(entry => { const video = entry.target.querySelector('video'); if (entry.isIntersecting) { if (!video.src) video.src = video.dataset.src; video.muted = isMuted; video.play().catch(() => {}); } else video.pause(); }); }, { threshold: 0.65 }); document.querySelectorAll('.video-item').forEach(seg => observer.observe(seg)); }
function toggleGlobalMute() { isMuted = !isMuted; document.querySelectorAll('video').forEach(v => v.muted = isMuted); const btns = document.querySelectorAll('.side-actions .side-btn:first-child i'); btns.forEach(btn => btn.className = isMuted ? 'fas fa-volume-mute' : 'fas fa-volume-up'); }
function switchFeed(feed) { currentFeed = feed; document.querySelectorAll('.top-tab').forEach(t => t.classList.remove('active')); event.target.classList.add('active'); renderVideos(); }

// ========== الإعجاب ==========
async function toggleLike(videoId, btn) { if (!currentUser) return; const videoRef = db.ref(`videos/${videoId}`); const snap = await videoRef.get(); const video = snap.val(); if (!video) return; let likes = video.likes || 0; let likedBy = video.likedBy || {}; if (likedBy[currentUser.uid]) { likes--; delete likedBy[currentUser.uid]; } else { likes++; likedBy[currentUser.uid] = true; await addNotification(video.sender, 'like', currentUser.uid); } await videoRef.update({ likes, likedBy }); btn.classList.toggle('active'); const countSpan = btn.querySelector('.count'); if (countSpan) countSpan.innerText = likes; playClickSound(); }

// ========== المتابعة ==========
async function toggleFollow(userId, btn) { if (!currentUser || currentUser.uid === userId) return; const userRef = db.ref(`users/${currentUser.uid}/following/${userId}`); const targetRef = db.ref(`users/${userId}/followers/${currentUser.uid}`); const snap = await userRef.get(); if (snap.exists()) { await userRef.remove(); await targetRef.remove(); btn.innerText = 'متابعة'; await addNotification(userId, 'unfollow', currentUser.uid); } else { await userRef.set(true); await targetRef.set(true); btn.innerText = 'متابع'; await addNotification(userId, 'follow', currentUser.uid); } if (viewingProfileUserId === userId) await loadProfileData(userId); playClickSound(); }

// ========== التعليقات والردود ==========
async function openComments(videoId) { currentVideoId = videoId; const panel = document.getElementById('commentsPanel'); const commentsRef = db.ref(`videos/${videoId}/comments`); const snap = await commentsRef.get(); const comments = snap.val() || {}; const container = document.getElementById('commentsList'); container.innerHTML = ''; for (const [commentId, c] of Object.entries(comments).reverse()) { const user = allUsers[c.userId] || { username: c.username || 'user', avatarUrl: '' }; const avatarHtml = (user.avatarUrl && user.avatarUrl !== '') ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0)?.toUpperCase() || '👤'); const repliesHtml = await renderReplies(videoId, commentId); container.innerHTML += `
            <div class="comment-item">
                <div class="comment-avatar">${avatarHtml}</div>
                <div class="comment-content">
                    <div class="font-bold">@${user.username}</div>
                    <div class="comment-text">${c.text}</div>
                    <div class="reply-btn" onclick="showReplyInput('${commentId}')">رد</div>
                    ${repliesHtml}
                </div>
            </div>
        `; }
    panel.classList.add('open'); }
function closeComments() { document.getElementById('commentsPanel').classList.remove('open'); currentReplyToCommentId = null; }
async function renderReplies(videoId, parentCommentId) { const repliesRef = db.ref(`videos/${videoId}/replies/${parentCommentId}`); const snap = await repliesRef.get(); const replies = snap.val() || {}; if (Object.keys(replies).length === 0) return ''; let html = '<div class="replies-container">'; for (const [replyId, r] of Object.entries(replies)) { const user = allUsers[r.userId] || { username: r.username || 'user', avatarUrl: '' }; const avatarHtml = (user.avatarUrl && user.avatarUrl !== '') ? `<img src="${user.avatarUrl}">` : (user.username?.charAt(0)?.toUpperCase() || '👤'); html += `<div class="comment-item mt-2"><div class="comment-avatar" style="width:28px;height:28px;">${avatarHtml}</div><div><div class="font-bold text-xs">@${user.username}</div><div class="text-xs">${r.text}</div></div></div>`; } html += '</div>'; return html; }
function showReplyInput(parentCommentId) { currentReplyToCommentId = parentCommentId; const input = document.getElementById('commentInput'); input.placeholder = 'اكتب رداً...'; input.focus(); }
async function addComment() { const input = document.getElementById('commentInput'); if (!input.value.trim() || !currentVideoId) return; if (currentReplyToCommentId) { await db.ref(`videos/${currentVideoId}/replies/${currentReplyToCommentId}`).push({ userId: currentUser.uid, username: currentUserData?.username, text: input.value, timestamp: Date.now() }); currentReplyToCommentId = null; } else { await db.ref(`videos/${currentVideoId}/comments`).push({ userId: currentUser.uid, username: currentUserData?.username, text: input.value, timestamp: Date.now() }); } input.value = ''; input.placeholder = 'أضف تعليقاً...'; openComments(currentVideoId); }

// ========== المشاركة ==========
function openShare(url) { currentShareUrl = url; document.getElementById('sharePanel').classList.add('open'); }
function closeShare() { document.getElementById('sharePanel').classList.remove('open'); }
function copyLink() { navigator.clipboard.writeText(currentShareUrl); showToast(); closeShare(); }
function shareToWhatsApp() { window.open(`https://wa.me/?text=${encodeURIComponent(currentShareUrl)}`, '_blank'); closeShare(); }
function shareToTelegram() { window.open(`https://t.me/share/url?url=${encodeURIComponent(currentShareUrl)}`, '_blank'); closeShare(); }
function downloadVideo() { window.open(currentShareUrl, '_blank'); closeShare(); }
function showToast() { const t = document.getElementById('copyToast'); t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 2000); }

// ========== الإشعارات ==========
async function addNotification(targetUserId, type, fromUserId) { if (targetUserId === fromUserId) return; const fromUser = allUsers[fromUserId] || { username: 'مستخدم' }; const messages = { like: 'أعجب بفيديو الخاص بك', comment: 'علق على فيديو الخاص بك', follow: 'بدأ بمتابعتك', unfollow: 'توقف عن متابعتك' }; await db.ref(`notifications/${targetUserId}`).push({ type, fromUserId, fromUsername: fromUser.username, message: messages[type], timestamp: Date.now(), read: false }); }
async function openNotifications() { const panel = document.getElementById('notificationsPanel'); const snap = await db.ref(`notifications/${currentUser.uid}`).once('value'); const notifs = snap.val() || {}; const container = document.getElementById('notificationsList'); container.innerHTML = ''; Object.values(notifs).reverse().forEach(n => { container.innerHTML += `<div class="notification-item"><i class="fas ${n.type === 'like' ? 'fa-heart text-red-500' : n.type === 'comment' ? 'fa-comment' : 'fa-user-plus'}"></i><div><div>${n.fromUsername}</div><div class="text-xs opacity-60">${n.message}</div></div></div>`; if (!n.read) db.ref(`notifications/${currentUser.uid}/${Object.keys(notifs).find(k => notifs[k] === n)}/read`).set(true); }); panel.classList.add('open'); }
function closeNotifications() { document.getElementById('notificationsPanel').classList.remove('open'); }

// ========== البحث ==========
function openSearch() { document.getElementById('searchPanel').classList.add('open'); }
function closeSearch() { document.getElementById('searchPanel').classList.remove('open'); }
function searchAll() { const query = document.getElementById('searchInput').value.toLowerCase(); const resultsDiv = document.getElementById('searchResults'); if (!query) { resultsDiv.innerHTML = ''; return; } const users = Object.values(allUsers).filter(u => u.username.toLowerCase().includes(query)); const videos = allVideos.filter(v => v.description?.toLowerCase().includes(query) || v.music?.toLowerCase().includes(query)); const hashtags = [...new Set(allVideos.flatMap(v => (v.description?.match(/#\w+/g) || []).filter(h => h.toLowerCase().includes(query))))]; resultsDiv.innerHTML = `${users.length ? `<div class="mb-5"><h4 class="text-sm opacity-60 mb-2">👥 مستخدمين</h4>${users.map(u => `<div class="search-result" onclick="viewProfile('${u.uid}')"><div class="search-avatar">${u.avatarUrl ? `<img src="${u.avatarUrl}">` : (u.username.charAt(0)?.toUpperCase() || '👤')}</div><div>@${u.username}</div></div>`).join('')}</div>` : ''}${hashtags.length ? `<div class="mb-5"><h4 class="text-sm opacity-60 mb-2"># هاشتاقات</h4>${hashtags.map(h => `<div class="search-result" onclick="searchHashtag('${h.substring(1)}')"><i class="fas fa-hashtag text-[#fe2c55] w-8 text-xl"></i><div>${h}</div></div>`).join('')}</div>` : ''}${videos.length ? `<div><h4 class="text-sm opacity-60 mb-2">🎬 فيديوهات</h4>${videos.map(v => `<div class="search-result" onclick="playVideo('${v.url}')"><i class="fas fa-video w-8 text-xl"></i><div>${(v.description || 'فيديو').substring(0, 40)}</div></div>`).join('')}</div>` : ''}`; }

// ========== الأصوات ==========
function openSounds() { document.getElementById('soundsPanel').classList.add('open'); }
function closeSounds() { document.getElementById('soundsPanel').classList.remove('open'); }
function renderSoundsList() { const container = document.getElementById('soundsList'); if (!container) return; const sortedSounds = Object.entries(allSounds).sort((a, b) => b[1] - a[1]); container.innerHTML = sortedSounds.map(([name, count]) => `<div class="sound-item" onclick="searchBySound('${name}')"><div class="sound-icon"><i class="fas fa-music"></i></div><div class="sound-info"><div class="sound-name">${name}</div><div class="sound-count">${count} فيديو</div></div></div>`).join(''); }
function searchBySound(soundName) { document.getElementById('searchInput').value = soundName; closeSounds(); openSearch(); searchAll(); }

// ========== الملف الشخصي ==========
async function viewProfile(userId) { if (!userId) return; viewingProfileUserId = userId; await loadProfileData(userId); document.getElementById('profilePanel').classList.add('open'); }
async function loadProfileData(userId) {
    const userSnap = await db.ref(`users/${userId}`).get(); const user = userSnap.val(); if (!user) return;
    const avatarDisplay = document.getElementById('profileAvatarDisplay'); if (user.avatarUrl && user.avatarUrl !== '') avatarDisplay.innerHTML = `<img src="${user.avatarUrl}">`; else avatarDisplay.innerHTML = user.username?.charAt(0)?.toUpperCase() || '👤';
    document.getElementById('profileNameDisplay').innerText = user.username || 'مستخدم'; document.getElementById('profileBioDisplay').innerText = user.bio || '';
    document.getElementById('profileFollowing').innerText = Object.keys(user.following || {}).length; document.getElementById('profileFollowers').innerText = Object.keys(user.followers || {}).length;
    const userVideos = allVideos.filter(v => v.sender === userId); const totalLikes = userVideos.reduce((sum, v) => sum + (v.likes || 0), 0); document.getElementById('profileLikes').innerText = totalLikes;
    const container = document.getElementById('profileVideosList'); container.innerHTML = ''; if (userVideos.length === 0) container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد فيديوهات بعد</div>'; else userVideos.forEach(v => { const thumb = document.createElement('div'); thumb.className = 'video-thumb'; thumb.innerHTML = '<i class="fas fa-play"></i>'; thumb.onclick = () => playVideo(v.url); container.appendChild(thumb); });
    const actionsDiv = document.getElementById('profileActions'); actionsDiv.innerHTML = '';
    if (userId === currentUser?.uid) { actionsDiv.innerHTML = `<button class="edit-profile-btn" onclick="openEditProfile()">تعديل الملف الشخصي</button><button class="logout-btn" onclick="logout()">تسجيل خروج</button>`; if (isAdmin) { const adminPanel = await renderAdminPanel(); actionsDiv.innerHTML += adminPanel; } }
    else { const isFollowing = currentUserData?.following && currentUserData.following[userId]; actionsDiv.innerHTML = `<button class="follow-btn" onclick="toggleFollow('${userId}', this)">${isFollowing ? 'متابع' : 'متابعة'}</button>`; addMessageButtonInProfile(userId); }
}
function openMyProfile() { if (currentUser) viewProfile(currentUser.uid); }
function closeProfile() { document.getElementById('profilePanel').classList.remove('open'); viewingProfileUserId = null; }
function openEditProfile() { document.getElementById('editUsername').value = currentUserData?.username || ''; document.getElementById('editBio').value = currentUserData?.bio || ''; const editAvatar = document.getElementById('editAvatarDisplay'); if (currentUserData?.avatarUrl) editAvatar.innerHTML = `<img src="${currentUserData.avatarUrl}">`; else editAvatar.innerHTML = currentUserData?.username?.charAt(0)?.toUpperCase() || '👤'; document.getElementById('editProfilePanel').classList.add('open'); }
function closeEditProfile() { document.getElementById('editProfilePanel').classList.remove('open'); }
async function saveProfile() { const newUsername = document.getElementById('editUsername').value; const newBio = document.getElementById('editBio').value; await db.ref(`users/${currentUser.uid}`).update({ username: newUsername, bio: newBio }); currentUserData.username = newUsername; currentUserData.bio = newBio; closeEditProfile(); if (viewingProfileUserId === currentUser.uid) await loadProfileData(currentUser.uid); renderVideos(); }
function changeAvatar() { document.getElementById('avatarInput').click(); }
async function uploadAvatar(input) { const file = input.files[0]; if (!file) return; const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET); const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd }); const data = await res.json(); await db.ref(`users/${currentUser.uid}/avatarUrl`).set(data.secure_url); currentUserData.avatarUrl = data.secure_url; if (viewingProfileUserId === currentUser.uid) await loadProfileData(currentUser.uid); renderVideos(); }
function playVideo(url) { window.open(url, '_blank'); }

// ========== القصص ==========
async function loadStories() {
    const storiesSnap = await db.ref('stories').once('value');
    const stories = storiesSnap.val() || {};
    const container = document.getElementById('storiesContainer');
    container.innerHTML = '';
    // قصة إضافة جديدة
    container.innerHTML += `<div class="story-item add-story" onclick="uploadStory()"><div class="story-avatar add-story"><i class="fas fa-plus text-white text-2xl"></i></div><div class="story-username">إضافة قصة</div></div>`;
    for (const [userId, userStories] of Object.entries(stories)) {
        const user = allUsers[userId];
        if (!user) continue;
        const activeStories = Object.values(userStories).filter(s => s.expiresAt > Date.now());
        if (activeStories.length === 0) continue;
        const latest = activeStories.sort((a,b)=>b.timestamp-a.timestamp)[0];
        container.innerHTML += `
            <div class="story-item" onclick="viewStory('${userId}')">
                <div class="story-avatar"><img src="${user.avatarUrl || 'https://via.placeholder.com/68'}" onerror="this.src='https://via.placeholder.com/68'"></div>
                <div class="story-username">@${user.username}</div>
            </div>
        `;
    }
}
async function uploadStory() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*,video/*';
    input.onchange = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
        const resourceType = file.type.startsWith('video/') ? 'video' : 'image';
        const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/${resourceType}/upload`, { method: 'POST', body: fd });
        const data = await res.json();
        const expiresAt = Date.now() + 24 * 60 * 60 * 1000; // 24 ساعة
        await db.ref(`stories/${currentUser.uid}`).push({ url: data.secure_url, type: resourceType, timestamp: Date.now(), expiresAt });
        loadStories();
    };
    input.click();
}
async function viewStory(userId) {
    const storiesSnap = await db.ref(`stories/${userId}`).once('value');
    const stories = storiesSnap.val() || {};
    currentStoryList = Object.values(stories).filter(s => s.expiresAt > Date.now()).sort((a,b)=>a.timestamp-b.timestamp);
    if (currentStoryList.length === 0) return;
    currentStoryIndex = 0;
    showStoryAtIndex(0);
    document.getElementById('storyViewer').classList.add('open');
}
function showStoryAtIndex(index) {
    if (index >= currentStoryList.length) { closeStoryViewer(); return; }
    const story = currentStoryList[index];
    const videoEl = document.getElementById('storyVideo');
    const imgEl = document.getElementById('storyImage');
    if (story.type === 'video') {
        videoEl.style.display = 'block';
        imgEl.style.display = 'none';
        videoEl.src = story.url;
        videoEl.play().catch(()=>{});
    } else {
        videoEl.style.display = 'none';
        imgEl.style.display = 'block';
        imgEl.src = story.url;
    }
    // بناء شريط التقدم
    const barContainer = document.getElementById('storyProgressBar');
    barContainer.innerHTML = '';
    for (let i = 0; i < currentStoryList.length; i++) {
        const segment = document.createElement('div');
        segment.className = 'story-progress-segment';
        segment.innerHTML = `<div class="story-progress-fill" id="progressFill${i}"></div>`;
        barContainer.appendChild(segment);
    }
    let duration = story.type === 'video' ? 10000 : 5000;
    const startTime = Date.now();
    const interval = setInterval(() => {
        const elapsed = Date.now() - startTime;
        const percent = Math.min(100, (elapsed / duration) * 100);
        document.getElementById(`progressFill${index}`).style.width = `${percent}%`;
        if (elapsed >= duration) {
            clearInterval(interval);
            currentStoryIndex++;
            showStoryAtIndex(currentStoryIndex);
        }
    }, 100);
    storyTimer = interval;
}
function closeStoryViewer() {
    if (storyTimer) clearInterval(storyTimer);
    document.getElementById('storyViewer').classList.remove('open');
    const videoEl = document.getElementById('storyVideo');
    videoEl.pause();
    videoEl.src = '';
}

// ========== الاكتشاف ==========
function openExplore() { document.getElementById('explorePanel').classList.add('open'); loadExploreVideos(); }
function closeExplore() { document.getElementById('explorePanel').classList.remove('open'); }
function loadExploreVideos() {
    const categories = ['الكل', 'رياضة', 'موسيقى', 'ألعاب', 'فنون', 'طعام'];
    const catsContainer = document.getElementById('exploreCategories');
    catsContainer.innerHTML = categories.map(cat => `<div class="category-chip ${cat === 'الكل' ? 'active' : ''}" onclick="filterExploreVideos('${cat}')">${cat}</div>`).join('');
    filterExploreVideos('الكل');
}
function filterExploreVideos(category) {
    document.querySelectorAll('.category-chip').forEach(chip => chip.classList.remove('active'));
    event.target.classList.add('active');
    let filtered = allVideos;
    if (category !== 'الكل') {
        // تصنيف بسيط حسب الكلمات المفتاحية في الوصف
        filtered = allVideos.filter(v => (v.description || '').toLowerCase().includes(category.toLowerCase()));
    }
    const container = document.getElementById('exploreVideosGrid');
    container.innerHTML = filtered.slice(0, 20).map(v => `
        <div class="explore-video-card" onclick="playVideo('${v.url}')">
            <video src="${v.url}" muted loop playsinline></video>
            <div class="explore-overlay">❤️ ${v.likes || 0}</div>
        </div>
    `).join('');
    // تشغيل المعاينة عند التحويم
    document.querySelectorAll('.explore-video-card video').forEach(vid => {
        vid.addEventListener('mouseenter', () => vid.play());
        vid.addEventListener('mouseleave', () => vid.pause());
    });
}

// ========== المشاهدة لاحقاً ==========
async function loadWatchLater() {
    if (!currentUser) return;
    const snap = await db.ref(`watchlater/${currentUser.uid}`).once('value');
    watchLaterList = Object.keys(snap.val() || {});
    renderWatchLater();
}
async function toggleWatchLater(videoId, btn) {
    if (!currentUser) return;
    const ref = db.ref(`watchlater/${currentUser.uid}/${videoId}`);
    const snap = await ref.get();
    if (snap.exists()) {
        await ref.remove();
        watchLaterList = watchLaterList.filter(id => id !== videoId);
        if (btn) btn.classList.remove('active');
    } else {
        await ref.set(true);
        watchLaterList.push(videoId);
        if (btn) btn.classList.add('active');
    }
    renderWatchLater();
}
async function renderWatchLater() {
    const container = document.getElementById('watchlaterList');
    if (!container) return;
    const videos = allVideos.filter(v => watchLaterList.includes(v.id));
    if (videos.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد فيديوهات محفوظة</div>'; return; }
    container.innerHTML = videos.map(v => `
        <div class="flex gap-3 p-3 border-b border-gray-800">
            <div class="w-24 h-32 bg-gray-800 rounded overflow-hidden cursor-pointer" onclick="playVideo('${v.url}')"><i class="fas fa-play text-center w-full mt-12"></i></div>
            <div class="flex-1"><div>${v.description?.substring(0, 50) || 'فيديو'}</div><div class="text-xs text-gray-400">@${v.senderName}</div><button class="text-red-500 text-sm mt-2" onclick="toggleWatchLater('${v.id}')">حذف</button></div>
        </div>
    `).join('');
}
function openWatchLater() { document.getElementById('watchlaterPanel').classList.add('open'); renderWatchLater(); }
function closeWatchLater() { document.getElementById('watchlaterPanel').classList.remove('open'); }

// ========== التقارير ==========
async function reportVideo(videoId) {
    const reason = prompt('سبب الإبلاغ:');
    if (!reason) return;
    await db.ref(`reports/videos/${videoId}`).push({ reporterId: currentUser.uid, reason, timestamp: Date.now() });
    alert('تم الإبلاغ بنجاح');
}
async function reportUser(userId) {
    const reason = prompt('سبب الإبلاغ عن المستخدم:');
    if (!reason) return;
    await db.ref(`reports/users/${userId}`).push({ reporterId: currentUser.uid, reason, timestamp: Date.now() });
    alert('تم الإبلاغ');
}
async function openReports() {
    if (!isAdmin) return;
    const panel = document.getElementById('reportsPanel');
    const reportsSnap = await db.ref('reports').once('value');
    const reports = reportsSnap.val() || {};
    const container = document.getElementById('reportsList');
    container.innerHTML = '';
    if (reports.videos) for (const [vid, reps] of Object.entries(reports.videos)) {
        container.innerHTML += `<div class="border-b border-gray-700 p-2"><strong>فيديو: ${vid}</strong><ul>${Object.values(reps).map(r => `<li>${r.reason} (من ${r.reporterId})</li>`).join('')}</ul><button class="admin-delete-btn" onclick="adminDeleteVideo('${vid}')">حذف الفيديو</button></div>`;
    }
    if (reports.users) for (const [uid, reps] of Object.entries(reports.users)) {
        container.innerHTML += `<div class="border-b border-gray-700 p-2"><strong>مستخدم: ${uid}</strong><ul>${Object.values(reps).map(r => `<li>${r.reason} (من ${r.reporterId})</li>`).join('')}</ul><button class="admin-ban-btn" onclick="adminBanUser('${uid}')">حظر المستخدم</button></div>`;
    }
    panel.classList.add('open');
}
function closeReports() { document.getElementById('reportsPanel').classList.remove('open'); }

// ========== الترندات ==========
function loadTrending() {
    const last24h = Date.now() - 24 * 60 * 60 * 1000;
    const trendingVideos = allVideos.filter(v => v.timestamp > last24h).sort((a,b) => (b.likes||0) - (a.likes||0)).slice(0, 10);
    const container = document.getElementById('trendingList');
    if (!container) return;
    if (trendingVideos.length === 0) { container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد ترندات اليوم</div>'; return; }
    container.innerHTML = trendingVideos.map((v,i) => `
        <div class="flex gap-3 p-3 border-b border-gray-800 cursor-pointer" onclick="playVideo('${v.url}')">
            <div class="text-2xl font-bold text-[#fe2c55] w-10">${i+1}</div>
            <div class="flex-1"><div>${v.description?.substring(0, 50) || 'فيديو'}</div><div class="text-xs text-gray-400">@${v.senderName} • ❤️ ${v.likes || 0}</div></div>
        </div>
    `).join('');
}
function openTrending() { document.getElementById('trendingPanel').classList.add('open'); loadTrending(); }
function closeTrending() { document.getElementById('trendingPanel').classList.remove('open'); }

// ========== الدردشة الخاصة ==========
let currentChatUserId = null;

async function openConversations() {
    const panel = document.getElementById('conversationsPanel');
    const container = document.getElementById('conversationsList');
    const userId = currentUser.uid;
    const convSnap = await db.ref(`private_chats/${userId}`).once('value');
    const conversations = convSnap.val() || {};
    container.innerHTML = '';
    for (const [otherId, convData] of Object.entries(conversations)) {
        const otherUser = allUsers[otherId];
        if (!otherUser) continue;
        const lastMsg = convData.lastMessage || '';
        container.innerHTML += `
            <div class="conversation-item" onclick="openPrivateChat('${otherId}')">
                <div class="conversation-avatar">${otherUser.avatarUrl ? `<img src="${otherUser.avatarUrl}">` : (otherUser.username?.charAt(0) || '👤')}</div>
                <div class="conversation-info">
                    <div class="conversation-name">@${otherUser.username}</div>
                    <div class="conversation-last-msg">${lastMsg.substring(0, 30)}</div>
                </div>
            </div>
        `;
    }
    if (container.innerHTML === '') container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد محادثات بعد</div>';
    panel.classList.add('open');
}
function closeConversations() { document.getElementById('conversationsPanel').classList.remove('open'); }
async function openPrivateChat(otherUserId) {
    currentChatUserId = otherUserId;
    const user = allUsers[otherUserId];
    document.getElementById('chatUserName').innerText = `@${user?.username || 'مستخدم'}`;
    document.getElementById('chatAvatarDisplay').innerHTML = user?.avatarUrl ? `<img src="${user.avatarUrl}" class="w-full h-full object-cover rounded-full">` : (user?.username?.charAt(0) || '👤');
    await loadPrivateMessages(otherUserId);
    document.getElementById('privateChatPanel').classList.add('open');
    closeConversations();
}
function closePrivateChat() { document.getElementById('privateChatPanel').classList.remove('open'); currentChatUserId = null; }
async function loadPrivateMessages(otherUserId) {
    const container = document.getElementById('privateMessagesList');
    container.innerHTML = '<div class="text-center text-gray-400 py-10">جاري التحميل...</div>';
    const chatId = getChatId(currentUser.uid, otherUserId);
    const messagesSnap = await db.ref(`private_messages/${chatId}`).once('value');
    const messages = messagesSnap.val() || {};
    container.innerHTML = '';
    const sortedMessages = Object.entries(messages).sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (const [msgId, msg] of sortedMessages) {
        const isSent = msg.senderId === currentUser.uid;
        const time = new Date(msg.timestamp).toLocaleTimeString();
        let content = '';
        if (msg.type === 'text') content = `<div class="message-bubble ${isSent ? 'sent' : 'received'}">${msg.text}</div>`;
        else if (msg.type === 'image') content = `<img src="${msg.imageUrl}" class="message-image" onclick="window.open('${msg.imageUrl}')">`;
        else if (msg.type === 'location') content = `<div class="message-bubble ${isSent ? 'sent' : 'received'}"><i class="fas fa-map-marker-alt"></i> <a href="${msg.locationUrl}" target="_blank">موقعي</a></div>`;
        else if (msg.type === 'video') content = `<video src="${msg.videoUrl}" class="message-image" controls></video>`;
        container.innerHTML += `<div class="private-message ${isSent ? 'sent' : 'received'}"><div class="message-content">${content}<div class="message-time">${time}</div></div></div>`;
    }
    if (container.innerHTML === '') container.innerHTML = '<div class="text-center text-gray-400 py-10">لا توجد رسائل بعد</div>';
    container.scrollTop = container.scrollHeight;
}
async function sendPrivateMessage() {
    const input = document.getElementById('privateMessageInput');
    const text = input.value.trim();
    if (!text || !currentChatUserId) return;
    const chatId = getChatId(currentUser.uid, currentChatUserId);
    const message = { senderId: currentUser.uid, senderName: currentUserData?.username, text: text, type: 'text', timestamp: Date.now(), read: false };
    await db.ref(`private_messages/${chatId}`).push(message);
    await updateChatPreview(chatId, text);
    input.value = '';
    await loadPrivateMessages(currentChatUserId);
}
async function sendChatImage(input) {
    const file = input.files[0];
    if (!file || !currentChatUserId) return;
    const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    const chatId = getChatId(currentUser.uid, currentChatUserId);
    const message = { senderId: currentUser.uid, senderName: currentUserData?.username, imageUrl: data.secure_url, type: 'image', timestamp: Date.now(), read: false };
    await db.ref(`private_messages/${chatId}`).push(message);
    await updateChatPreview(chatId, '📷 صورة');
    input.value = '';
    await loadPrivateMessages(currentChatUserId);
}
async function sendLocation() {
    if (!navigator.geolocation) { alert('الموقع غير مدعوم'); return; }
    navigator.geolocation.getCurrentPosition(async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const locationUrl = `https://maps.google.com/?q=${lat},${lng}`;
        const chatId = getChatId(currentUser.uid, currentChatUserId);
        const message = { senderId: currentUser.uid, senderName: currentUserData?.username, locationUrl: locationUrl, type: 'location', timestamp: Date.now(), read: false };
        await db.ref(`private_messages/${chatId}`).push(message);
        await updateChatPreview(chatId, '📍 موقع');
        await loadPrivateMessages(currentChatUserId);
    });
}
function startRecording() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) { alert('التسجيل غير مدعوم'); return; }
    navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then(stream => {
        mediaRecorder = new MediaRecorder(stream);
        recordedChunks = [];
        mediaRecorder.ondataavailable = e => recordedChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/mp4' });
            const file = new File([blob], 'video.mp4', { type: 'video/mp4' });
            uploadRecordedVideo(file);
            stream.getTracks().forEach(track => track.stop());
        };
        mediaRecorder.start();
        alert('بدء التسجيل... اضغط OK عند الانتهاء');
        setTimeout(() => mediaRecorder.stop(), 10000); // توقف تلقائي بعد 10 ثوانٍ
    });
}
async function uploadRecordedVideo(file) {
    const fd = new FormData(); fd.append('file', file); fd.append('upload_preset', UPLOAD_PRESET);
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`, { method: 'POST', body: fd });
    const data = await res.json();
    const chatId = getChatId(currentUser.uid, currentChatUserId);
    const message = { senderId: currentUser.uid, senderName: currentUserData?.username, videoUrl: data.secure_url, type: 'video', timestamp: Date.now(), read: false };
    await db.ref(`private_messages/${chatId}`).push(message);
    await updateChatPreview(chatId, '🎥 فيديو');
    await loadPrivateMessages(currentChatUserId);
}
async function updateChatPreview(chatId, lastMsg) {
    const [uid1, uid2] = chatId.split('_');
    const otherId = uid1 === currentUser.uid ? uid2 : uid1;
    await db.ref(`private_chats/${currentUser.uid}/${otherId}`).set({ lastMessage: lastMsg, lastTimestamp: Date.now(), withUser: otherId });
    await db.ref(`private_chats/${otherId}/${currentUser.uid}`).set({ lastMessage: lastMsg, lastTimestamp: Date.now(), withUser: currentUser.uid });
}
function addMessageButtonInProfile(userId) {
    const actionsDiv = document.getElementById('profileActions');
    if (actionsDiv && userId !== currentUser?.uid) {
        const existingBtn = document.getElementById('msgProfileBtn');
        if (!existingBtn) {
            const msgBtn = document.createElement('button');
            msgBtn.id = 'msgProfileBtn';
            msgBtn.className = 'edit-profile-btn ml-2';
            msgBtn.innerHTML = '<i class="fas fa-envelope"></i> رسالة';
            msgBtn.onclick = () => openPrivateChat(userId);
            actionsDiv.appendChild(msgBtn);
        }
    }
}
function getChatId(uid1, uid2) { return uid1 < uid2 ? `${uid1}_${uid2}` : `${uid2}_${uid1}`; }
db.ref(`private_messages`).on('child_added', async (snapshot) => {
    const chatId = snapshot.key;
    if (currentChatUserId && chatId === getChatId(currentUser.uid, currentChatUserId)) await loadPrivateMessages(currentChatUserId);
    if (document.getElementById('conversationsPanel').classList.contains('open')) openConversations();
});

// ========== رفع الفيديو المحسن ==========
let selectedVideoFile = null;
let popularHashtags = ['تيك_توك', 'ترند', 'اكسبلور', 'فن', 'موسيقى', 'ضحك', 'رياضة', 'طبخ', 'سفر', 'تحدي'];
let popularMusics = ['Original Sound', 'موسيقى هادئة', 'ريمكس ترند', 'أغنية جديدة', 'تيك توك ريمكس'];

function openUploadPanel() { document.getElementById('uploadPanel').classList.add('open'); resetUploadForm(); }
function closeUploadPanel() { document.getElementById('uploadPanel').classList.remove('open'); resetUploadForm(); }
function resetUploadForm() { selectedVideoFile = null; document.getElementById('videoPreview').style.display = 'none'; document.querySelector('.preview-placeholder').style.display = 'block'; document.getElementById('videoDescription').value = ''; document.getElementById('videoMusic').value = ''; document.getElementById('uploadProgressBar').style.display = 'none'; document.getElementById('uploadStatus').innerHTML = ''; document.getElementById('uploadSubmitBtn').classList.remove('disabled'); document.getElementById('uploadSubmitBtn').disabled = false; document.getElementById('videoFileInput').value = ''; }
function previewVideo(file) { if (!file) return; selectedVideoFile = file; const reader = new FileReader(); reader.onload = function(e) { const videoPreview = document.getElementById('videoPreview'); videoPreview.src = e.target.result; videoPreview.style.display = 'block'; document.querySelector('.preview-placeholder').style.display = 'none'; }; reader.readAsDataURL(file); }
function selectVideoFile(input) { const file = input.files[0]; if (file && file.type.startsWith('video/')) { if (file.size > 100 * 1024 * 1024) { alert('حجم الفيديو يجب أن يكون أقل من 100MB'); return; } previewVideo(file); } else { alert('الرجاء اختيار ملف فيديو صحيح'); } }
function showHashtagSuggestions() { const textarea = document.getElementById('videoDescription'); const suggestionsDiv = document.getElementById('hashtagSuggestions'); const text = textarea.value; const lastWord = text.split(' ').pop(); if (lastWord.startsWith('#')) { const searchTerm = lastWord.substring(1).toLowerCase(); const filtered = popularHashtags.filter(h => h.includes(searchTerm)); if (filtered.length > 0) { suggestionsDiv.innerHTML = filtered.map(h => `<span class="hashtag-suggestion" onclick="insertHashtag('${h}')">#${h}</span>`).join(''); } else { suggestionsDiv.innerHTML = ''; } } else { suggestionsDiv.innerHTML = ''; } }
function insertHashtag(hashtag) { const textarea = document.getElementById('videoDescription'); const text = textarea.value; const lastWord = text.split(' ').pop(); const newText = text.substring(0, text.length - lastWord.length) + '#' + hashtag + ' '; textarea.value = newText; textarea.focus(); document.getElementById('hashtagSuggestions').innerHTML = ''; }
function showMusicSuggestions() { const input = document.getElementById('videoMusic'); const suggestionsDiv = document.getElementById('musicSuggestions'); const query = input.value.toLowerCase(); if (query.length > 0) { const filtered = popularMusics.filter(m => m.toLowerCase().includes(query)); if (filtered.length > 0) { suggestionsDiv.innerHTML = filtered.map(m => `<div class="music-suggestion" onclick="selectMusic('${m}')"><i class="fas fa-music"></i><div class="music-name">${m}</div><div class="music-count">شائع</div></div>`).join(''); } else { suggestionsDiv.innerHTML = ''; } } else { suggestionsDiv.innerHTML = ''; } }
function selectMusic(musicName) { document.getElementById('videoMusic').value = musicName; document.getElementById('musicSuggestions').innerHTML = ''; }
async function uploadVideoWithDetails() {
    if (!selectedVideoFile) { alert('الرجاء اختيار فيديو أولاً'); return; }
    const description = document.getElementById('videoDescription').value;
    const music = document.getElementById('videoMusic').value || 'Original Sound';
    const visibility = document.getElementById('videoVisibility').value;
    const commentsSetting = document.getElementById('videoComments').value;
    const progressBar = document.getElementById('uploadProgressBar'); const progressFill = document.getElementById('progressFill'); const progressText = document.getElementById('progressText'); const statusDiv = document.getElementById('uploadStatus'); const submitBtn = document.getElementById('uploadSubmitBtn');
    progressBar.style.display = 'block'; submitBtn.classList.add('disabled'); submitBtn.disabled = true; statusDiv.innerHTML = ''; progressFill.style.width = '0%'; progressText.innerText = '0%';
    try {
        const formData = new FormData(); formData.append('file', selectedVideoFile); formData.append('upload_preset', UPLOAD_PRESET); formData.append('resource_type', 'video');
        const xhr = new XMLHttpRequest(); xhr.open('POST', `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/video/upload`);
        xhr.upload.onprogress = (e) => { if (e.lengthComputable) { const percent = Math.round((e.loaded / e.total) * 100); progressFill.style.width = `${percent}%`; progressText.innerText = `${percent}%`; } };
        const response = await new Promise((resolve, reject) => { xhr.onload = () => resolve(xhr); xhr.onerror = () => reject(xhr); xhr.send(formData); });
        const result = JSON.parse(response.responseText);
        await db.ref('videos/').push({ url: result.secure_url, thumbnail: result.secure_url.replace('.mp4', '.jpg'), description, music, visibility, commentsSetting, sender: currentUser.uid, senderName: currentUserData?.username, likes: 0, likedBy: {}, comments: {}, timestamp: Date.now() });
        statusDiv.innerHTML = '<i class="fas fa-check-circle"></i> تم رفع الفيديو بنجاح!'; statusDiv.style.color = '#4caf50';
        setTimeout(() => { closeUploadPanel(); renderVideos(); }, 1500);
    } catch (error) { console.error('Upload error:', error); statusDiv.innerHTML = '<i class="fas fa-exclamation-circle"></i> فشل الرفع: ' + error.message; statusDiv.style.color = '#ff4444'; progressBar.style.display = 'none'; submitBtn.classList.remove('disabled'); submitBtn.disabled = false; }
}
function loadPopularMusics() { const sounds = Object.keys(allSounds).sort((a, b) => allSounds[b] - allSounds[a]); popularMusics = sounds.slice(0, 10); if (popularMusics.length === 0) popularMusics = ['Original Sound', 'موسيقى هادئة', 'ريمكس ترند', 'أغنية جديدة', 'تيك توك ريمكس']; }
setInterval(loadPopularMusics, 30000);

// ========== الوضع الليلي ==========
function toggleTheme() {
    const body = document.body;
    if (body.classList.contains('dark-mode')) {
        body.classList.remove('dark-mode');
        body.classList.add('light-mode');
        document.getElementById('themeToggle').className = 'fas fa-moon top-icon';
    } else {
        body.classList.remove('light-mode');
        body.classList.add('dark-mode');
        document.getElementById('themeToggle').className = 'fas fa-sun top-icon';
    }
    localStorage.setItem('theme', body.classList.contains('dark-mode') ? 'dark' : 'light');
}
function loadTheme() {
    const saved = localStorage.getItem('theme');
    if (saved === 'light') {
        document.body.classList.add('light-mode');
        document.getElementById('themeToggle').className = 'fas fa-moon top-icon';
    } else {
        document.body.classList.add('dark-mode');
        document.getElementById('themeToggle').className = 'fas fa-sun top-icon';
    }
}

// ========== تأثيرات صوتية ==========
function playClickSound() {
    const audio = new Audio('https://www.soundjay.com/misc/sounds/button-click-01.mp3');
    audio.volume = 0.2;
    audio.play().catch(()=>{});
}

// ========== شاشة الترحيب ==========
function hideSplash() {
    const splash = document.getElementById('splashScreen');
    if (splash) splash.style.display = 'none';
}
setTimeout(hideSplash, 2500);

// ========== التبويب السفلي ==========
function switchTab(tab) {
    document.querySelectorAll('.nav-item').forEach(t => t.classList.remove('active'));
    if (event.target.closest('.nav-item')) event.target.closest('.nav-item').classList.add('active');
    if (tab === 'search') openSearch();
    if (tab === 'notifications') openNotifications();
    if (tab === 'explore') openExplore();
    if (tab === 'home') { closeSearch(); closeNotifications(); closeProfile(); closeSounds(); closeUploadPanel(); closeConversations(); closePrivateChat(); closeExplore(); closeWatchLater(); closeTrending(); }
    if (tab === 'profile') openMyProfile();
}

// ========== مراقبة المستخدم ==========
auth.onAuthStateChanged(async (user) => {
    if (user) {
        currentUser = user; await loadUserData(); checkAdminStatus();
        document.getElementById('loginScreen').style.display = 'none';
        document.getElementById('mainApp').style.display = 'block';
        const presenceRef = db.ref('presence/' + user.uid); presenceRef.set(true); presenceRef.onDisconnect().remove();
        loadStories();
        loadWatchLater();
        loadTheme();
    } else {
        document.getElementById('loginScreen').style.display = 'flex';
        document.getElementById('mainApp').style.display = 'none';
    }
});
console.log('✅ SHΔDØW Ultimate System Ready');
