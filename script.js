import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    onAuthStateChanged, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    getDoc, 
    updateDoc, 
    deleteDoc, 
    query, 
    orderBy, 
    serverTimestamp, 
    setDoc 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// Cấu hình Firebase công khai mẫu
const firebaseConfig = {
    apiKey: "AIzaSyDummyKeyForShareHubDemo99281",
    authDomain: "sharehub-demo.firebaseapp.com",
    projectId: "sharehub-demo",
    storageBucket: "sharehub-demo.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abcdef"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

let currentUser = null;
let allFiles = [];
let selectedImagesBase64 = [];

// Khởi tạo ứng dụng
window.addEventListener('DOMContentLoaded', () => {
    checkAdminAccount();
    loadFiles();
    loadChatMessages();
    checkActiveAnnouncement();

    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        const authNavArea = document.getElementById('authNavArea');
        const authorInput = document.getElementById('authorName');

        if (user) {
            let displayName = user.email.split('@')[0];
            let isAdmin = (user.email === 'tdzadmin@sharehub.com' || displayName.toUpperCase() === 'TDZADMIN');

            if (isAdmin) {
                displayName = 'TDZADMIN';
                if (!document.getElementById('adminTabBtn')) {
                    const navActions = document.querySelector('.nav-actions');
                    const adminBtn = document.createElement('button');
                    adminBtn.id = 'adminTabBtn';
                    adminBtn.className = 'nav-btn';
                    adminBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Admin`;
                    adminBtn.onclick = () => switchTab('admin');
                    navActions.insertBefore(adminBtn, navActions.children[2]);
                }
            }

            authNavArea.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-weight:700; color:var(--primary);">${displayName} ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
                    <button class="nav-btn" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i></button>
                </div>
            `;
            if (authorInput) authorInput.value = displayName;
        } else {
            authNavArea.innerHTML = `<button class="nav-btn login" onclick="openAuthModal()"><i class="fa-solid fa-user-lock"></i> Đăng nhập</button>`;
            const adminTab = document.getElementById('adminTabBtn');
            if (adminTab) adminTab.remove();
        }
    });
});

// Tự động kiểm tra / khởi tạo tài khoản TDZADMIN
async function checkAdminAccount() {
    try {
        await signInWithEmailAndPassword(auth, 'tdzadmin@sharehub.com', 'TDZ2013@');
    } catch (e) {
        try {
            await createUserWithEmailAndPassword(auth, 'tdzadmin@sharehub.com', 'TDZ2013@');
        } catch (err) {}
    }
}

// Chuyển Tab giao diện
window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// Hiển thị Toast thông báo
function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

// Xử lý Ảnh Preview (Max 3)
window.handleImagePreviews = function(event) {
    const files = event.target.files;
    const container = document.getElementById('previewContainer');
    container.innerHTML = '';
    selectedImagesBase64 = [];

    if (files.length > 3) {
        showToast('Chỉ được chọn tối đa 3 ảnh xem trước!');
        event.target.value = '';
        return;
    }

    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const reader = new FileReader();
        reader.onload = function(e) {
            selectedImagesBase64.push(e.target.result);
            const thumb = document.createElement('div');
            thumb.className = 'preview-thumb';
            thumb.innerHTML = `<img src="${e.target.result}"><button type="button" class="remove-thumb" onclick="removePreview(${i})">&times;</button>`;
            container.appendChild(thumb);
        };
        reader.readAsDataURL(file);
    }
}

window.checkFileSize = function(input) {
    if (input.files[0] && input.files[0].size > 1024 * 1024 * 1024) {
        showToast('File vượt quá giới hạn 1GB!');
        input.value = '';
    }
}

// Đăng bài file mới lên Firestore
window.handleUpload = async function(event) {
    event.preventDefault();
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để đăng file!');
        openAuthModal();
        return;
    }

    const fileInput = document.getElementById('fileInput');
    const mainTitle = document.getElementById('mainTitle').value;
    const subContent = document.getElementById('subContent').value;
    const authorName = document.getElementById('authorName').value;

    showToast('Đang tải lên máy chủ...');

    try {
        const fileData = {
            title: mainTitle,
            subContent: subContent,
            author: authorName,
            fileName: fileInput.files[0] ? fileInput.files[0].name : 'shared_file.zip',
            fileSize: fileInput.files[0] ? (fileInput.files[0].size / (1024*1024)).toFixed(2) + ' MB' : '10.5 MB',
            images: selectedImagesBase64,
            downloads: 0,
            views: 0,
            createdAt: serverTimestamp()
        };

        await addDoc(collection(db, "sharedFiles"), fileData);
        showToast('Đăng file thành công!');
        document.getElementById('uploadForm').reset();
        document.getElementById('previewContainer').innerHTML = '';
        selectedImagesBase64 = [];
        loadFiles();
        switchTab('feed');
    } catch (e) {
        showToast('Lỗi đăng file: ' + e.message);
    }
}

// Tải danh sách file từ Firestore
async function loadFiles() {
    const grid = document.getElementById('fileGrid');
    try {
        const q = query(collection(db, "sharedFiles"), orderBy("createdAt", "desc"));
        const snapshot = await getDocs(q);
        allFiles = [];
        snapshot.forEach(docSnap => {
            allFiles.push({ id: docSnap.id, ...docSnap.data() });
        });
        renderFiles(allFiles);
    } catch (e) {
        grid.innerHTML = `<p style="color:var(--text-muted)">Chưa có dữ liệu hoặc lỗi kết nối máy chủ.</p>`;
    }
}

function renderFiles(files) {
    const grid = document.getElementById('fileGrid');
    if (files.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted)">Không tìm thấy file nào.</p>`;
        return;
    }

    grid.innerHTML = files.map(file => {
        let isAdmin = (file.author === 'TDZADMIN');
        let thumbHtml = file.images && file.images.length > 0 
            ? `<div class="file-card-thumbs">${file.images.map(img => `<img src="${img}">`).join('')}</div>` 
            : '';

        return `
            <div class="file-card">
                <div>
                    <div class="file-card-header">
                        <h3 class="file-card-title" onclick="viewFileDetail('${file.id}')">${file.title}</h3>
                        <span class="file-badge">${file.fileSize || 'File'}</span>
                    </div>
                    <p class="file-card-desc">${file.subContent || 'Không có mô tả phụ.'}</p>
                    ${thumbHtml}
                </div>
                <div class="file-card-footer">
                    <div>
                        <span class="author-tag">${file.author}</span> ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}
                    </div>
                    <div class="card-actions">
                        <button class="action-icon-btn" onclick="viewFileDetail('${file.id}')" title="Xem chi tiết"><i class="fa-solid fa-eye"></i></button>
                        <button class="action-icon-btn" onclick="copyShareLink('${file.id}')" title="Sao chép Link"><i class="fa-solid fa-share-nodes"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

window.filterFiles = function() {
    const keyword = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allFiles.filter(f => f.title.toLowerCase().includes(keyword) || f.author.toLowerCase().includes(keyword));
    renderFiles(filtered);
}

// Xem chi tiết bài viết
window.viewFileDetail = async function(fileId) {
    switchTab('detail');
    const detailContainer = document.getElementById('detailContent');
    detailContainer.innerHTML = `<div style="text-align:center; padding:40px;"><i class="fa-solid fa-spinner fa-spin fa-2x"></i></div>`;

    try {
        const docRef = doc(db, "sharedFiles", fileId);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            let isAdmin = (data.author === 'TDZADMIN');

            await updateDoc(docRef, { views: (data.views || 0) + 1 });

            let galleryHtml = data.images && data.images.length > 0
                ? `<div class="detail-gallery">${data.images.map(img => `<img src="${img}">`).join('')}</div>`
                : '';

            detailContainer.innerHTML = `
                <h1 class="detail-main-title">${data.title}</h1>
                <div class="detail-sub-content">${data.subContent || 'Không có nội dung phụ mô tả.'}</div>
                ${galleryHtml}
                <div class="detail-download-box">
                    <p style="margin-bottom: 15px; color:var(--text-muted);"><i class="fa-solid fa-file-zipper"></i> Tệp: <strong>${data.fileName}</strong> (${data.fileSize})</p>
                    <a href="#" class="download-btn" onclick="triggerDownload('${data.fileName}')"><i class="fa-solid fa-download"></i> Tải file về máy</a>
                </div>
                <div class="detail-footer-info">
                    <span>Tác giả: <strong>${data.author}</strong> ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
                    <span>Lượt tải: <strong id="dlCount">${data.downloads || 0}</strong> | Lượt xem: <strong>${(data.views || 0) + 1}</strong></span>
                </div>
            `;
        } else {
            detailContainer.innerHTML = `<p>Không tìm thấy file này trên máy chủ.</p>`;
        }
    } catch (e) {
        detailContainer.innerHTML = `<p>Lỗi tải thông tin chi tiết.</p>`;
    }
}

window.triggerDownload = function(fileName) {
    showToast(`Đang bắt đầu tải xuống: ${fileName}`);
}

window.copyShareLink = function(fileId) {
    const url = window.location.href.split('#')[0] + '#' + fileId;
    navigator.clipboard.writeText(url);
    showToast('Đã sao chép liên kết chia sẻ!');
}

// Phòng trò chuyện realtime
async function loadChatMessages() {
    const chatContainer = document.getElementById('chatMessages');
    try {
        const q = query(collection(db, "communityChat"), orderBy("createdAt", "asc"));
        const snapshot = await getDocs(q);
        chatContainer.innerHTML = '';
        snapshot.forEach(docSnap => {
            const msg = docSnap.data();
            appendChatMessageUI(msg);
        });
        chatContainer.scrollTop = chatContainer.scrollHeight;
    } catch (e) {
        chatContainer.innerHTML = `<p style="color:var(--text-muted)">Chưa có tin nhắn nào.</p>`;
    }
}

function appendChatMessageUI(msg) {
    const chatContainer = document.getElementById('chatMessages');
    let isAdmin = (msg.author === 'TDZADMIN');
    let isMine = currentUser && currentUser.email === msg.email;

    const div = document.createElement('div');
    div.className = `chat-msg ${isMine ? 'mine' : ''}`;
    div.innerHTML = `
        <div class="chat-msg-header">
            <span class="chat-msg-author">${msg.author} ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
            <span>${new Date(msg.createdAt?.toDate?.() || Date.now()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
        </div>
        <div class="chat-msg-body">${msg.text}</div>
    `;
    chatContainer.appendChild(div);
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

window.sendChatMessage = async function(event) {
    event.preventDefault();
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để nhắn tin!');
        openAuthModal();
        return;
    }

    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    let authorName = currentUser.email.split('@')[0];
    if (currentUser.email === 'tdzadmin@sharehub.com') authorName = 'TDZADMIN';

    const msgData = {
        text: text,
        author: authorName,
        email: currentUser.email,
        createdAt: serverTimestamp()
    };

    try {
        await addDoc(collection(db, "communityChat"), msgData);
        input.value = '';
        loadChatMessages();
    } catch (e) {
        showToast('Không gửi được tin nhắn.');
    }
}

// Hệ thống Đăng nhập / Đăng ký
window.openAuthModal = function() {
    document.getElementById('authModal').style.display = 'flex';
}
window.closeAuthModal = function() {
    document.getElementById('authModal').style.display = 'none';
}
window.switchAuthMode = function(mode) {
    document.getElementById('tabLoginBtn').classList.toggle('active', mode === 'login');
    document.getElementById('tabRegisterBtn').classList.toggle('active', mode === 'register');
    document.getElementById('loginForm').classList.toggle('active', mode === 'login');
    document.getElementById('registerForm').classList.toggle('active', mode === 'register');
}

window.handleRegister = async function(event) {
    event.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;

    try {
        await createUserWithEmailAndPassword(auth, email, password);
        showToast('Đăng ký tài khoản thành công!');
        closeAuthModal();
    } catch (e) {
        showToast('Lỗi đăng ký: ' + e.message);
    }
}

window.handleLogin = async function(event) {
    event.preventDefault();
    let identifier = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    if (identifier.toUpperCase() === 'TDZADMIN') {
        identifier = 'tdzadmin@sharehub.com';
    } else if (!identifier.includes('@')) {
        identifier = identifier + '@sharehub.com';
    }

    try {
        await signInWithEmailAndPassword(auth, identifier, password);
        showToast('Đăng nhập thành công!');
        closeAuthModal();
    } catch (e) {
        showToast('Sai tài khoản hoặc mật khẩu!');
    }
}

window.handleLogout = async function() {
    await signOut(auth);
    showToast('Đã đăng xuất tài khoản.');
}

// Admin Announcement
window.publishAnnouncement = async function() {
    if (!currentUser || currentUser.email !== 'tdzadmin@sharehub.com') {
        showToast('Chỉ tài khoản Admin mới có quyền này!');
        return;
    }
    const text = document.getElementById('adminAnnouncementInput').value.trim();
    if (!text) return;

    try {
        await setDoc(doc(db, "serverConfig", "announcement"), { text: text, active: true });
        showToast('Đã phát thông báo toàn server!');
        checkActiveAnnouncement();
    } catch (e) {
        showToast('Lỗi phát thông báo.');
    }
}

window.clearAnnouncement = async function() {
    try {
        await setDoc(doc(db, "serverConfig", "announcement"), { text: "", active: false });
        document.getElementById('announcement-banner').style.display = 'none';
        showToast('Đã xóa thông báo.');
    } catch (e) {}
}

async function checkActiveAnnouncement() {
    try {
        const snap = await getDoc(doc(db, "serverConfig", "announcement"));
        if (snap.exists() && snap.data().active && snap.data().text) {
            document.getElementById('banner-text').innerText = snap.data().text;
            document.getElementById('announcement-banner').style.display = 'flex';
        } else {
            document.getElementById('announcement-banner').style.display = 'none';
        }
    } catch (e) {}
}

window.dismissBanner = function() {
    document.getElementById('announcement-banner').style.display = 'none';
}
