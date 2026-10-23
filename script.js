let currentUser = null;
let allFiles = [];
let selectedImagesBase64 = [];
let currentBanUsername = null;
let currentReportFileId = null;

// Khởi tạo hệ thống chạy ngay lập tức
(function initApp() {
    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    if (!users.some(u => u.username.toUpperCase() === 'TDZADMIN')) {
        users.push({ username: 'TDZADMIN', password: 'TDZ2013@', bannedUntil: 0, banReason: '' });
        localStorage.setItem('sharehub_users', JSON.stringify(users));
    }

    checkStoredSession();
    loadFiles();
    loadChatMessages();
    checkActiveAnnouncement();
})();

function showToast(message) {
    const toast = document.getElementById('toast');
    toast.innerText = message;
    toast.style.display = 'block';
    setTimeout(() => { toast.style.display = 'none'; }, 3000);
}

window.switchTab = function(tabName) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.getElementById(`tab-${tabName}`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (tabName === 'admin') {
        loadAdminData();
    }
}

// Xử lý Ảnh Preview (Tối đa 3 ảnh)
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

// BẤM TẠO -> LƯU VÀ MỞ THẲNG TRANG CHI TIẾT TRÊN WEB CHÍNH
window.handleUpload = function(event) {
    event.preventDefault();
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để tạo trang!');
        openAuthModal();
        return;
    }

    if (isUserBanned(currentUser)) {
        showToast('Tài khoản của bạn đang bị cấm, không thể tạo trang!');
        return;
    }

    const fileInput = document.getElementById('fileInput');
    const mainTitle = document.getElementById('mainTitle').value;
    const subContent = document.getElementById('subContent').value;
    const authorName = document.getElementById('authorName').value;

    const file = fileInput.files[0];
    if (!file) {
        showToast('Vui lòng chọn file cần chia sẻ!');
        return;
    }

    showToast('Đang tạo trang web mới...');

    const reader = new FileReader();
    reader.onload = function(e) {
        const fileDataUrl = e.target.result;
        const fileSize = (file.size / (1024 * 1024)).toFixed(2) + ' MB';

        const newFile = {
            id: 'file_' + Date.now(),
            title: mainTitle,
            subContent: subContent,
            author: authorName,
            fileName: file.name,
            fileSize: fileSize,
            fileDataUrl: fileDataUrl,
            images: [...selectedImagesBase64],
            downloads: 0,
            views: 0,
            createdAt: Date.now()
        };

        let files = JSON.parse(localStorage.getItem('sharehub_files') || '[]');
        files.unshift(newFile);
        localStorage.setItem('sharehub_files', JSON.stringify(files));

        showToast('Tạo trang thành công!');
        document.getElementById('uploadForm').reset();
        document.getElementById('previewContainer').innerHTML = '';
        selectedImagesBase64 = [];
        loadFiles();

        // Mở thẳng trang chi tiết của file vừa tạo trên giao diện web chính
        viewFileDetail(newFile.id);
    };

    reader.readAsDataURL(file);
};

function loadFiles() {
    allFiles = JSON.parse(localStorage.getItem('sharehub_files') || '[]');
    renderFiles(allFiles);
}

function renderFiles(files) {
    const grid = document.getElementById('fileGrid');
    if (files.length === 0) {
        grid.innerHTML = `<p style="color:var(--text-muted)">Chưa có file nào được chia sẻ.</p>`;
        return;
    }

    grid.innerHTML = files.map(file => {
        let isAdmin = (file.author.toUpperCase() === 'TDZADMIN');
        let canDelete = currentUser && (currentUser === file.author || currentUser.toUpperCase() === 'TDZADMIN');
        
        let thumbHtml = file.images && file.images.length > 0 
            ? `<div class="file-card-thumbs">${file.images.map(img => `<img src="${img}">`).join('')}</div>` 
            : '';

        let deleteBtnHtml = canDelete 
            ? `<button class="action-icon-btn" style="border-color: #ff3366; color: #ff3366;" onclick="deleteFile('${file.id}')" title="Xóa file"><i class="fa-solid fa-trash"></i></button>` 
            : '';

        let reportBtnHtml = currentUser 
            ? `<button class="action-icon-btn" onclick="openReportModal('${file.id}')" title="Báo cáo bài viết"><i class="fa-solid fa-triangle-exclamation"></i></button>`
            : '';

        return `
            <div class="file-card">
                <div>
                    <div class="file-card-header">
                        <h3 class="file-card-title" onclick="viewFileDetail('${file.id}')">${file.title}</h3>
                        <span class="file-badge">${file.fileSize}</span>
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
                        ${reportBtnHtml}
                        ${deleteBtnHtml}
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

// Xóa file/bài viết
window.deleteFile = function(fileId) {
    if (!confirm('Bạn có chắc chắn muốn xóa bài viết này không?')) return;

    let files = JSON.parse(localStorage.getItem('sharehub_files') || '[]');
    files = files.filter(f => f.id !== fileId);
    localStorage.setItem('sharehub_files', JSON.stringify(files));

    showToast('Đã xóa bài viết thành công!');
    switchTab('feed');
    loadFiles();
}

// Xem chi tiết file
window.viewFileDetail = function(fileId) {
    switchTab('detail');
    const detailContainer = document.getElementById('detailContent');
    let files = JSON.parse(localStorage.getItem('sharehub_files') || '[]');
    const file = files.find(f => f.id === fileId);

    if (file) {
        file.views = (file.views || 0) + 1;
        localStorage.setItem('sharehub_files', JSON.stringify(files));

        let isAdmin = (file.author.toUpperCase() === 'TDZADMIN');
        let canDelete = currentUser && (currentUser === file.author || currentUser.toUpperCase() === 'TDZADMIN');

        let galleryHtml = file.images && file.images.length > 0
            ? `<div class="detail-gallery">${file.images.map(img => `<img src="${img}">`).join('')}</div>`
            : '';

        let deleteBtnDetail = canDelete 
            ? `<button class="admin-btn danger" onclick="deleteFile('${file.id}')" style="margin-top:15px; width:100%;"><i class="fa-solid fa-trash"></i> Xóa bài viết này</button>` 
            : '';

        detailContainer.innerHTML = `
            <h1 class="detail-main-title">${file.title}</h1>
            <div class="detail-sub-content">${file.subContent || 'Không có nội dung phụ mô tả.'}</div>
            ${galleryHtml}
            <div class="detail-download-box">
                <p style="margin-bottom: 15px; color:var(--text-muted);"><i class="fa-solid fa-file-zipper"></i> Tệp: <strong>${file.fileName}</strong> (${file.fileSize})</p>
                <a href="#" class="download-btn" onclick="triggerDownload(event, '${file.id}')"><i class="fa-solid fa-download"></i> Tải file về máy</a>
            </div>
            ${deleteBtnDetail}
            <div class="detail-footer-info" style="margin-top: 15px;">
                <span>Tác giả: <strong>${file.author}</strong> ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
                <span>Lượt tải: <strong id="dlCount">${file.downloads || 0}</strong> | Lượt xem: <strong>${file.views}</strong></span>
            </div>
        `;
    } else {
        detailContainer.innerHTML = `<p>Không tìm thấy file.</p>`;
    }
}

// Tải đúng file gốc về máy
window.triggerDownload = function(event, fileId) {
    event.preventDefault();
    let files = JSON.parse(localStorage.getItem('sharehub_files') || '[]');
    const file = files.find(f => f.id === fileId);
    
    if (file) {
        file.downloads = (file.downloads || 0) + 1;
        localStorage.setItem('sharehub_files', JSON.stringify(files));
        
        const dlEl = document.getElementById('dlCount');
        if (dlEl) dlEl.innerText = file.downloads;

        if (file.fileDataUrl) {
            const a = document.createElement('a');
            a.href = file.fileDataUrl;
            a.download = file.fileName;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        } else {
            showToast('Không tìm thấy dữ liệu tệp gốc!');
            return;
        }

        showToast(`Đang tải xuống: ${file.fileName}`);
    }
}

window.copyShareLink = function(fileId) {
    const url = window.location.href.split('#')[0] + '#' + fileId;
    navigator.clipboard.writeText(url);
    showToast('Đã sao chép liên kết chia sẻ!');
}

// Phòng trò chuyện
function loadChatMessages() {
    const chatContainer = document.getElementById('chatMessages');
    const messages = JSON.parse(localStorage.getItem('sharehub_chat') || '[]');
    chatContainer.innerHTML = '';

    if (messages.length === 0) {
        chatContainer.innerHTML = `<p style="color:var(--text-muted)">Chưa có tin nhắn nào trong phòng chat.</p>`;
        return;
    }

    chatContainer.innerHTML = messages.map(msg => {
        let isAdmin = (msg.author.toUpperCase() === 'TDZADMIN');
        let isMine = currentUser && currentUser === msg.author;
        return `
            <div class="chat-msg ${isMine ? 'mine' : ''}">
                <div class="chat-msg-header">
                    <span class="chat-msg-author">${msg.author} ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
                    <span>${new Date(msg.time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
                </div>
                <div class="chat-msg-body">${msg.text}</div>
            </div>
        `;
    }).join('');
    chatContainer.scrollTop = chatContainer.scrollHeight;
}

window.sendChatMessage = function(event) {
    event.preventDefault();
    if (!currentUser) {
        showToast('Vui lòng đăng nhập để nhắn tin!');
        openAuthModal();
        return;
    }

    if (isUserBanned(currentUser)) {
        showToast('Tài khoản của bạn đang bị cấm, không thể nhắn tin!');
        return;
    }

    const input = document.getElementById('chatInput');
    const text = input.value.trim();
    if (!text) return;

    let messages = JSON.parse(localStorage.getItem('sharehub_chat') || '[]');
    messages.push({
        author: currentUser,
        text: text,
        time: Date.now()
    });
    localStorage.setItem('sharehub_chat', JSON.stringify(messages));
    input.value = '';
    loadChatMessages();
}

// BÁO CÁO BÀI VIẾT (REPORT)
window.openReportModal = function(fileId) {
    currentReportFileId = fileId;
    document.getElementById('reportModal').style.display = 'flex';
}
window.closeReportModal = function() {
    document.getElementById('reportModal').style.display = 'none';
}
window.submitReport = function(event) {
    event.preventDefault();
    const reason = document.getElementById('reportReason').value;

    let reports = JSON.parse(localStorage.getItem('sharehub_reports') || '[]');
    reports.push({
        id: 'rep_' + Date.now(),
        fileId: currentReportFileId,
        reporter: currentUser,
        reason: reason,
        time: Date.now()
    });
    localStorage.setItem('sharehub_reports', JSON.stringify(reports));

    showToast('Đã gửi báo cáo thành công cho Admin!');
    closeReportModal();
}

// HỆ THỐNG BAN & BỎ CẤM TÀI KHOẢN (ADMIN ONLY)
window.openBanModal = function(username) {
    currentBanUsername = username;
    document.getElementById('banTargetUser').innerText = username;
    document.getElementById('banYears').value = 0;
    document.getElementById('banMonths').value = 0;
    document.getElementById('banWeeks').value = 0;
    document.getElementById('banDays').value = 0;
    document.getElementById('banHours').value = 0;
    document.getElementById('banMinutes').value = 0;
    document.getElementById('banReasonPreset').value = '';
    document.getElementById('banReasonCustom').value = '';
    document.getElementById('banModal').style.display = 'flex';
}
window.closeBanModal = function() {
    document.getElementById('banModal').style.display = 'none';
}
window.selectBanPreset = function(select) {
    if (select.value) {
        document.getElementById('banReasonCustom').value = select.value;
    }
}

window.confirmBan = function(event) {
    event.preventDefault();
    if (!currentUser || currentUser.toUpperCase() !== 'TDZADMIN') return;

    const years = parseInt(document.getElementById('banYears').value) || 0;
    const months = parseInt(document.getElementById('banMonths').value) || 0;
    const weeks = parseInt(document.getElementById('banWeeks').value) || 0;
    const days = parseInt(document.getElementById('banDays').value) || 0;
    const hours = parseInt(document.getElementById('banHours').value) || 0;
    const minutes = parseInt(document.getElementById('banMinutes').value) || 0;
    const reason = document.getElementById('banReasonCustom').value.trim() || 'Vi phạm nội quy server';

    if (years === 0 && months === 0 && weeks === 0 && days === 0 && hours === 0 && minutes === 0) {
        showToast('Vui lòng chọn thời gian cấm lớn hơn 0!');
        return;
    }

    let banDurationMs = 
        years * 365 * 24 * 60 * 60 * 1000 +
        months * 30 * 24 * 60 * 60 * 1000 +
        weeks * 7 * 24 * 60 * 60 * 1000 +
        days * 24 * 60 * 60 * 1000 +
        hours * 60 * 60 * 1000 +
        minutes * 60 * 1000;

    let bannedUntil = Date.now() + banDurationMs;

    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    users = users.map(u => {
        if (u.username.toLowerCase() === currentBanUsername.toLowerCase()) {
            u.bannedUntil = bannedUntil;
            u.banReason = reason;
        }
        return u;
    });
    localStorage.setItem('sharehub_users', JSON.stringify(users));

    showToast(`Đã cấm tài khoản ${currentBanUsername} thành công!`);
    closeBanModal();
    loadAdminData();
}

// BỎ CẤM (UNBAN) TÀI KHOẢN
window.unbanUser = function(username) {
    if (!currentUser || currentUser.toUpperCase() !== 'TDZADMIN') {
        showToast('Chỉ Admin mới có quyền mở khóa!');
        return;
    }

    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    let found = false;

    users = users.map(u => {
        if (u.username.toLowerCase() === username.toLowerCase()) {
            u.bannedUntil = 0;
            u.banReason = '';
            found = true;
        }
        return u;
    });

    if (found) {
        localStorage.setItem('sharehub_users', JSON.stringify(users));
        showToast(`Đã BỎ CẤM thành công cho tài khoản ${username}!`);
        loadAdminData();
    } else {
        showToast('Không tìm thấy tài khoản!');
    }
}

window.deleteAccount = function(username) {
    if (username.toUpperCase() === 'TDZADMIN') {
        showToast('Không thể xóa tài khoản Admin tối cao!');
        return;
    }
    if (!confirm(`Bạn có chắc muốn xóa vĩnh viễn tài khoản ${username}?`)) return;

    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    users = users.filter(u => u.username.toLowerCase() !== username.toLowerCase());
    localStorage.setItem('sharehub_users', JSON.stringify(users));
    showToast(`Đã xóa tài khoản ${username}!`);
    loadAdminData();
}

function isUserBanned(username) {
    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    const user = users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (user && user.bannedUntil && user.bannedUntil > Date.now()) {
        return true;
    }
    return false;
}

function loadAdminData() {
    if (!currentUser || currentUser.toUpperCase() !== 'TDZADMIN') return;

    // Load Hòm thư báo cáo
    const reportContainer = document.getElementById('adminReportList');
    const reports = JSON.parse(localStorage.getItem('sharehub_reports') || '[]');
    const files = JSON.parse(localStorage.getItem('sharehub_files') || '[]');

    if (reports.length === 0) {
        reportContainer.innerHTML = `<p style="color:var(--text-muted); font-size:0.9rem;">Hòm thư trống, không có báo cáo nào.</p>`;
    } else {
        reportContainer.innerHTML = reports.map(rep => {
            const file = files.find(f => f.id === rep.fileId);
            const fileTitle = file ? file.title : 'Bài viết đã bị xóa';
            return `
                <div class="report-item">
                    <div>
                        <strong style="color:var(--admin-red);">[${rep.reason}]</strong> 
                        <span>Người báo cáo: <strong>${rep.reporter}</strong></span>
                        <div style="font-size: 0.85rem; color:var(--text-muted); margin-top:4px;">Bài viết: <em>${fileTitle}</em> (${new Date(rep.time).toLocaleString()})</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        ${file ? `<button class="action-icon-btn" onclick="viewFileDetail('${rep.fileId}')" title="Xem bài"><i class="fa-solid fa-eye"></i></button>` : ''}
                        <button class="action-icon-btn" style="border-color:#ff3366; color:#ff3366;" onclick="deleteReport('${rep.id}')" title="Xóa báo cáo"><i class="fa-solid fa-check"></i></button>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Load Danh sách tài khoản kèm nút Cấm / Bỏ Cấm
    const tableBody = document.getElementById('accountsTableBody');
    const users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    
    tableBody.innerHTML = users.map(u => {
        let isBanned = u.bannedUntil && u.bannedUntil > Date.now();
        
        let banStatusText = isBanned 
            ? `<span style="color:var(--admin-red); font-weight:700;"><i class="fa-solid fa-lock"></i> Đang bị cấm (Đến ${new Date(u.bannedUntil).toLocaleString()})</span><br><small style="color:var(--text-muted);">Lý do: ${u.banReason}</small>` 
            : `<span style="color:#10b981; font-weight:600;"><i class="fa-solid fa-circle-check"></i> Hoạt động bình thường</span>`;

        let actionBtns = u.username.toUpperCase() === 'TDZADMIN' 
            ? `<span style="color:var(--text-muted);">Admin Tối Cao</span>`
            : (isBanned 
                ? `<button class="admin-btn" style="padding:6px 12px; font-size:0.85rem; background:#10b981; color:#000;" onclick="unbanUser('${u.username}')"><i class="fa-solid fa-lock-open"></i> Bỏ cấm</button>` 
                : `<button class="admin-btn danger" style="padding:6px 12px; font-size:0.85rem;" onclick="openBanModal('${u.username}')"><i class="fa-solid fa-ban"></i> Cấm</button>`) +
              `<button class="admin-btn danger" style="padding:6px 12px; font-size:0.85rem; background:#334155; margin-left:6px;" onclick="deleteAccount('${u.username}')"><i class="fa-solid fa-trash"></i> Xóa</button>`;

        return `
            <tr>
                <td><strong>${u.username}</strong></td>
                <td>${banStatusText}</td>
                <td>${actionBtns}</td>
            </tr>
        `;
    }).join('');
}

window.deleteReport = function(repId) {
    let reports = JSON.parse(localStorage.getItem('sharehub_reports') || '[]');
    reports = reports.filter(r => r.id !== repId);
    localStorage.setItem('sharehub_reports', JSON.stringify(reports));
    loadAdminData();
    showToast('Đã xóa báo cáo khỏi hòm thư.');
}

// Xác thực & Tài khoản
window.openAuthModal = function() { document.getElementById('authModal').style.display = 'flex'; }
window.closeAuthModal = function() { document.getElementById('authModal').style.display = 'none'; }
window.switchAuthMode = function(mode) {
    document.getElementById('tabLoginBtn').classList.toggle('active', mode === 'login');
    document.getElementById('tabRegisterBtn').classList.toggle('active', mode === 'register');
    document.getElementById('loginForm').classList.toggle('active', mode === 'login');
    document.getElementById('registerForm').classList.toggle('active', mode === 'register');
}

window.handleRegister = function(event) {
    event.preventDefault();
    const username = document.getElementById('regUsername').value.trim();
    const password = document.getElementById('regPassword').value;

    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    if (users.some(u => u.username.toLowerCase() === username.toLowerCase())) {
        showToast('Tên tài khoản đã tồn tại!');
        return;
    }

    users.push({ username, password, bannedUntil: 0, banReason: '' });
    localStorage.setItem('sharehub_users', JSON.stringify(users));
    showToast('Đăng ký thành công! Hãy đăng nhập.');
    switchAuthMode('login');
}

window.handleLogin = function(event) {
    event.preventDefault();
    const usernameInput = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    let users = JSON.parse(localStorage.getItem('sharehub_users') || '[]');
    const user = users.find(u => u.username.toLowerCase() === usernameInput.toLowerCase() && u.password === password);

    if (user) {
        if (user.bannedUntil && user.bannedUntil > Date.now()) {
            showToast(`Tài khoản bị cấm đến ${new Date(user.bannedUntil).toLocaleString()}. Lý do: ${user.banReason}`);
            return;
        }

        currentUser = user.username;
        localStorage.setItem('sharehub_session', currentUser);
        updateAuthUI();
        closeAuthModal();
        showToast(`Đăng nhập thành công với tên ${currentUser}!`);
    } else {
        showToast('Sai tài khoản hoặc mật khẩu!');
    }
}

window.handleLogout = function() {
    currentUser = null;
    localStorage.removeItem('sharehub_session');
    updateAuthUI();
    showToast('Đã đăng xuất.');
    switchTab('feed');
}

function checkStoredSession() {
    const session = localStorage.getItem('sharehub_session');
    if (session) {
        if (isUserBanned(session)) {
            localStorage.removeItem('sharehub_session');
            return;
        }
        currentUser = session;
        updateAuthUI();
    }
}

function updateAuthUI() {
    const authNavArea = document.getElementById('authNavArea');
    const adminInboxNavArea = document.getElementById('adminInboxNavArea');
    const authorInput = document.getElementById('authorName');

    if (currentUser) {
        let isAdmin = (currentUser.toUpperCase() === 'TDZADMIN');
        
        if (isAdmin) {
            if (!document.getElementById('adminTabBtn')) {
                const navActions = document.querySelector('.nav-actions');
                const adminBtn = document.createElement('button');
                adminBtn.id = 'adminTabBtn';
                adminBtn.className = 'nav-btn';
                adminBtn.innerHTML = `<i class="fa-solid fa-shield-halved"></i> Admin`;
                adminBtn.onclick = () => switchTab('admin');
                navActions.insertBefore(adminBtn, navActions.children[2]);
            }
            adminInboxNavArea.innerHTML = `<button class="nav-btn inbox" onclick="switchTab('admin')"><i class="fa-solid fa-inbox"></i> Hòm thư</button>`;
        }

        authNavArea.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px;">
                <span style="font-weight:700; color:var(--primary);">${currentUser} ${isAdmin ? '<span class="admin-badge">[ADMIN]</span>' : ''}</span>
                <button class="nav-btn" onclick="handleLogout()"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        `;
        if (authorInput) authorInput.value = currentUser;
    } else {
        authNavArea.innerHTML = `<button class="nav-btn login" onclick="openAuthModal()"><i class="fa-solid fa-user-lock"></i> Đăng nhập</button>`;
        adminInboxNavArea.innerHTML = '';
        const adminTab = document.getElementById('adminTabBtn');
        if (adminTab) adminTab.remove();
    }
}

// Thông báo Server của Admin
window.publishAnnouncement = function() {
    if (!currentUser || currentUser.toUpperCase() !== 'TDZADMIN') {
        showToast('Chỉ tài khoản Admin mới có quyền này!');
        return;
    }
    const text = document.getElementById('adminAnnouncementInput').value.trim();
    if (!text) return;

    localStorage.setItem('sharehub_announcement', JSON.stringify({ text, active: true }));
    showToast('Đã phát thông báo toàn server!');
    checkActiveAnnouncement();
}

window.clearAnnouncement = function() {
    localStorage.removeItem('sharehub_announcement');
    document.getElementById('announcement-banner').style.display = 'none';
    showToast('Đã xóa thông báo.');
}

function checkActiveAnnouncement() {
    const ann = JSON.parse(localStorage.getItem('sharehub_announcement'));
    if (ann && ann.active && ann.text) {
        document.getElementById('banner-text').innerText = ann.text;
        document.getElementById('announcement-banner').style.display = 'flex';
    } else {
        document.getElementById('announcement-banner').style.display = 'none';
    }
}

window.dismissBanner = function() {
    document.getElementById('announcement-banner').style.display = 'none';
}
