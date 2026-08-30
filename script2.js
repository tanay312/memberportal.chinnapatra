
        const SUPABASE_URL = 'https://azdwdqwhwrhmcsxgwzal.supabase.co';
        const SUPABASE_KEY = 'sb_publishable_offnM0Rq9v3WUqIco1Dowg_EIe-9MEV';
        const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

        const DB = {
            get: async (table) => {
                const { data, error } = await supabaseClient.from(table).select('*');
                if (error) { console.error(`Error fetching ${table}:`, error); return []; }
                return data || [];
            },
            insert: async (table, row) => {
                const { data, error } = await supabaseClient.from(table).insert([row]).select();
                if (error) { UI.showToast(`DB Error: ${error.message}`, 'error'); return null; }
                return data ? data[0] : null;
            }
        };

        const UI = {
            showToast: (msg, type = 'success') => {
                const toast = document.createElement('div');
                toast.className = `toast ${type === 'error' ? 'error' : ''}`;
                toast.innerHTML = `<i class="ph-fill ${type === 'error' ? 'ph-warning-circle' : 'ph-check-circle'}" style="font-size: 24px; color: ${type === 'error' ? 'var(--danger)' : 'var(--success)'};"></i> <span>${msg}</span>`;
                document.getElementById('toastArea').appendChild(toast);
                setTimeout(() => toast.classList.add('show'), 10);
                setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 400); }, 3000);
            },
            showModal: (title, html) => {
                document.getElementById('modalBody').innerHTML = html;
                document.getElementById('mainModal').classList.add('active');
            },
            closeModal: () => { document.getElementById('mainModal').classList.remove('active'); },
            switchView: (viewId) => {
                document.querySelectorAll('.page-view').forEach(v => v.classList.remove('active'));
                document.getElementById(viewId).classList.add('active');
            }
        };

        function spawnConfetti() {
            const colors = ['#D4AF37', '#1F2937', '#0A1128', '#FFFFFF'];
            for (let i = 0; i < 100; i++) {
                let conf = document.createElement('div');
                conf.className = 'confetti';
                conf.style.left = Math.random() * 100 + 'vw';
                conf.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
                conf.style.animationDuration = (Math.random() * 3 + 2) + 's';
                conf.style.animationDelay = Math.random() * 2 + 's';
                document.body.appendChild(conf);
            }
        }

        const ArtistAuth = {
            tempUser: null,
            toggleView: (type) => {
                document.getElementById('formLogin').style.display = type === 'login' ? 'block' : 'none';
                document.getElementById('formSetup').style.display = type === 'setup' ? 'block' : 'none';
                document.getElementById('formNewPass').style.display = 'none';
            },
            verifyInitial: async (e) => {
                e.preventDefault();
                const idInput = document.getElementById('setupId').value.trim().toUpperCase();
                const mobileInput = document.getElementById('setupMobile').value.replace(/\D/g, ''); 
                
                const btn = e.target.querySelector('button');
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Verifying...'; btn.disabled = true;

                const { data, error } = await supabaseClient.from('artists').select('*');
                btn.innerHTML = 'Verify Identity'; btn.disabled = false;

                if (error || !data || data.length === 0) return UI.showToast('Database Error or No Artists found.', 'error');

                const artist = data.find(a => {
                    if (!a || !a.id || !a.mobile_number) return false;
                    const dbMob = a.mobile_number.replace(/\D/g, '');
                    const mobileMatch = dbMob === mobileInput || dbMob.includes(mobileInput);
                    const dbId = a.id.toUpperCase();
                    const idMatch = dbId === idInput || dbId.startsWith(idInput) || dbId.substring(0, 6) === idInput;
                    return mobileMatch && idMatch;
                });

                if (!artist) return UI.showToast('ID and Mobile do not match.', 'error');
                if (artist.password) return UI.showToast('Password already set. Please login.', 'error');

                ArtistAuth.tempUser = artist;
                ArtistAuth.toggleView('none');
                document.getElementById('formNewPass').style.display = 'block';
                UI.showToast('Verified! Create your password.', 'success');
            },
            saveNewPassword: async (e) => {
                e.preventDefault();
                const p1 = document.getElementById('newPass1').value;
                const p2 = document.getElementById('newPass2').value;

                if (p1 !== p2) return UI.showToast('Passwords do not match!', 'error');

                const btn = e.target.querySelector('button');
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Saving...'; btn.disabled = true;

                const { error } = await supabaseClient.from('artists').update({ password: p1 }).eq('id', ArtistAuth.tempUser.id);
                btn.innerHTML = 'Save & Login'; btn.disabled = false;

                if (error) return UI.showToast('Failed to save password.', 'error');

                sessionStorage.setItem('artist_session', JSON.stringify(ArtistAuth.tempUser));
                UI.showToast('Password Set! Welcome.', 'success');
                ArtistApp.init();
            },
            login: async (e) => {
                e.preventDefault();
                const idInput = document.getElementById('loginId').value.trim().toUpperCase();
                const passInput = document.getElementById('loginPass').value;
                
                const btn = e.target.querySelector('button');
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Authenticating...'; btn.disabled = true;

                const { data, error } = await supabaseClient.from('artists').select('*');
                btn.innerHTML = 'Secure Login <i class="ph-bold ph-arrow-right"></i>'; btn.disabled = false;

                if (error || !data || data.length === 0) return UI.showToast('Database Error.', 'error');

                const artist = data.find(a => {
                    if (!a || !a.id || !a.password) return false;
                    const passMatch = a.password === passInput;
                    const dbId = a.id.toUpperCase();
                    const idMatch = dbId === idInput || dbId.startsWith(idInput) || dbId.substring(0, 6) === idInput;
                    return passMatch && idMatch;
                });

                if (!artist) return UI.showToast('Invalid ID or Password.', 'error');

                sessionStorage.setItem('artist_session', JSON.stringify(artist));
                UI.showToast(`Welcome back, ${artist.name}!`);
                ArtistApp.init();
            },
            logout: () => {
                sessionStorage.removeItem('artist_session');
                location.reload(); 
            }
        };

        const ArtistApp = {
            user: null,
            myScore: 0,
            notificationsLoaded: false,

            toggleSidebar: () => { document.getElementById('sidebar').classList.toggle('active'); },
            toggleNotifications: () => { 
                const panel = document.getElementById('notifPanel');
                panel.classList.toggle('active'); 
                if(panel.classList.contains('active')) {
                    document.getElementById('notifBadge').style.display = 'none'; // Clear badge when opened
                    if(!ArtistApp.notificationsLoaded) ArtistApp.loadNotifications();
                }
            },
            installPWA: () => {
                if (deferredPrompt) {
                    deferredPrompt.prompt();
                    deferredPrompt.userChoice.then((choiceResult) => {
                        if (choiceResult.outcome === 'accepted') UI.showToast('Installing...', 'success');
                        deferredPrompt = null;
                        document.getElementById('installAppContainer').style.display = 'none';
                    });
                } else {
                    UI.showToast('Use browser menu: "Add to Home screen"', 'warning');
                }
            },

            init: async () => {
                let session = sessionStorage.getItem('artist_session');
                if (!session) { UI.switchView('view-auth'); return; }

                ArtistApp.user = JSON.parse(session);
                UI.switchView('view-dashboard');

                document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'short', day: 'numeric' });

                // Truncate ID to first 6 characters
                const shortId = (ArtistApp.user.id || '').substring(0, 6).toUpperCase();

                // 1. Basic Text Information
document.getElementById('sidebarName').innerText = ArtistApp.user.name;
document.getElementById('idCardName').innerText = ArtistApp.user.name;
document.getElementById('idCardId').innerText = shortId; 
document.getElementById('idCardDob').innerText = ArtistApp.user.dob || '--/--/----';
document.getElementById('idCardMob').innerText = ArtistApp.user.mobile_number || 'N/A';

// 2. Avatar Generation
const avatarContent = ArtistApp.user.image_link 
    ? `<img src="${ArtistApp.user.image_link}">` 
    : ArtistApp.user.name.charAt(0);
document.getElementById('sidebarAvatar').innerHTML = avatarContent;
document.getElementById('idCardAvatar').innerHTML = avatarContent;

// 3. Department Logic (Max 3 per line for ID Card)
const deptData = ArtistApp.user.department;

if (deptData) {
    // Standard comma-separated string for the sidebar
    document.getElementById('sidebarDept').innerText = Array.isArray(deptData) 
        ? deptData.join(', ') 
        : deptData;

    // Process chunks of 3 for the ID card
    const depts = Array.isArray(deptData) ? deptData : deptData.split(',').map(d => d.trim());
    const chunks = [];
    
    for (let i = 0; i < depts.length; i += 3) {
        chunks.push(depts.slice(i, i + 3).join(', '));
    }
    
    // Use innerHTML to render the <br> line breaks
    document.getElementById('idCardDept').innerHTML = chunks.join('<br>');
        document.getElementById('sidebarDept').innerHTML = chunks.join('<br>');
} else {
    // Fallbacks if no department data exists
    document.getElementById('sidebarDept').innerText = 'General Team';
    document.getElementById('idCardDept').innerText = 'Creative Team';
        
}

                document.getElementById('gName').value = ArtistApp.user.name;
                document.getElementById('gId').value = shortId;
                document.getElementById('gMobile').value = ArtistApp.user.mobile_number || '';
                if(ArtistApp.user.email) document.getElementById('gEmail').value = ArtistApp.user.email;

                // Load initial data
                await ArtistApp.calculateMyPoints();
                ArtistApp.checkLeaveStatus();
                ArtistApp.checkBirthday();
                ArtistApp.loadWork();
                ArtistApp.loadLeaves();
                ArtistApp.loadVault();
                ArtistApp.loadLeaderboard();
                ArtistApp.loadGrievances();
                ArtistApp.loadNotifications();
                
                // Simulate checking for new notifications
                setTimeout(() => {
                    document.getElementById('notifBadge').style.display = 'block';
                }, 3000);
                    AutoRefresh.start(30000);
            },

            loadNotifications: async () => {
                // Fetch messages where target is 'ALL_ARTISTS' OR target matches this specific artist's ID
                const { data, error } = await supabaseClient
                    .from('admin_messages')
                    .select('*')
                    .or(`target_member_id.eq.ALL_ARTISTS,target_member_id.eq.${ArtistApp.user.id}`)
                    .order('created_at', { ascending: false })
                    .limit(10);
                
                if (!error && data && data.length > 0) {
                    ArtistApp.notificationsData = data.map(d => ({
                        id: d.id,
                        title: d.title,
                        message: d.message,
                        date: new Date(d.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }),
                        read: false
                    }));
                } else {
                    ArtistApp.notificationsData = [];
                }
                // Fixed: Passing the data into the render function so it actually displays
                ArtistApp.renderNotifications(ArtistApp.notificationsData); 
            },

            renderNotifications: (notifs) => {
                const body = document.getElementById('notifBody');
                const badge = document.getElementById('notifBadge');
                
                // 1. Calculate and update the unread badge on the bell icon
                if (notifs) {
                    const unreadCount = notifs.filter(n => !n.read).length;
                    if (badge) {
                        if (unreadCount > 0) {
                            badge.style.display = 'flex';
                            badge.innerText = unreadCount;
                        } else {
                            badge.style.display = 'none';
                        }
                    }
                }

                // 2. Empty state UI
                if(!notifs || notifs.length === 0) {
                    body.innerHTML = `
                        <div style="text-align: center; padding: 40px 20px;">
                            <div style="width: 64px; height: 64px; background: rgba(11,25,56,0.03); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;">
                                <i class="ph-fill ph-bell-slash" style="font-size: 28px; color: var(--text-muted); opacity: 0.5;"></i>
                            </div>
                            <p style="font-size: 13px; color: var(--text-muted); font-weight: 500;">You're all caught up!</p>
                            <p style="font-size: 11px; color: rgba(11,25,56,0.3); margin-top: 4px;">No new messages from Admin</p>
                        </div>`;
                    return;
                }
                
                // 3. Render Premium Notification Cards
                let html = '';
                notifs.forEach((n, i) => {
                    const dateStr = n.date || 'Unknown Date'; 
                    
                    // Design variables based on Read/Unread state
                    const bgColor = n.read ? 'var(--surface)' : 'rgba(200, 155, 60, 0.05)';
                    const borderColor = n.read ? 'rgba(0,0,0,0.05)' : 'rgba(200, 155, 60, 0.3)';
                    const iconBg = n.read ? 'rgba(11, 25, 56, 0.04)' : 'rgba(200, 155, 60, 0.15)';
                    const iconColor = n.read ? 'var(--text-muted)' : 'var(--gold)';
                    const titleColor = n.read ? 'var(--secondary)' : 'var(--primary)';
                    
                    html += `
                        <div class="notif-item ${n.read ? '' : 'unread'}" 
                             style="animation-delay: ${i * 0.05}s; display: flex; align-items: flex-start; gap: 14px; padding: 16px; border-radius: 12px; background: ${bgColor}; border: 1px solid ${borderColor}; position: relative; overflow: hidden; cursor: pointer; transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);" 
                             onclick="ArtistApp.markNotifRead(${n.id}, event)"
                             onmouseover="this.style.transform='translateX(4px)'; this.style.boxShadow='var(--shadow-sm)';"
                             onmouseout="this.style.transform='translateX(0)'; this.style.boxShadow='none';">
                            
                            <!-- Left Accent Line for Unread -->
                            ${!n.read ? '<div style="position: absolute; top: 0; left: 0; bottom: 0; width: 4px; background: var(--gold);"></div>' : ''}
                            
                            <!-- Admin / Broadcast Icon -->
                            <div style="width: 42px; height: 42px; border-radius: 50%; background: ${iconBg}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; color: ${iconColor}; font-size: 20px; transition: 0.3s;">
                                <i class="ph-fill ph-broadcast"></i>
                            </div>
                            
                            <!-- Notification Text Content -->
                            <div style="flex: 1; min-width: 0;">
                                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                    <span style="font-weight: 700; color: ${titleColor}; font-size: 14px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 160px;">
                                        ${n.title || 'Admin Message'}
                                    </span>
                                    <span style="font-size: 10px; color: var(--text-muted); font-weight: 600;">${dateStr}</span>
                                </div>
                                <div style="font-size: 12px; color: var(--text-muted); line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
                                    ${n.message}
                                </div>
                            </div>
                            
                            <!-- Unread Red Dot -->
                            ${!n.read ? '<div style="width: 10px; height: 10px; background: var(--danger); border-radius: 50%; margin-top: 6px; flex-shrink: 0; box-shadow: 0 0 0 2px var(--surface);"></div>' : ''}
                        </div>
                    `;
                });
                body.innerHTML = html;
            },
            clearNotifications: (e) => {
                if (e) e.stopPropagation();
                // Mark all as read
                ArtistApp.notificationsData = ArtistApp.notificationsData.map(n => ({...n, read: true}));
                // Re-render the UI with the updated data
                ArtistApp.renderNotifications(ArtistApp.notificationsData);
                UI.showToast('All messages marked as read.', 'success');
            },

            markNotifRead: (id, e) => {
                if (e) e.stopPropagation();
                
                // Find the specific notification that was clicked
                const notif = ArtistApp.notificationsData.find(n => n.id === id);
                
                // If it exists and is currently unread, mark it as read
                if (notif && !notif.read) {
                    notif.read = true;
                    
                    // Instantly re-render the list so the unread styling and badge count update
                    ArtistApp.renderNotifications(ArtistApp.notificationsData);
                }
            },

            calculateMyPoints: async () => {
                const activities = await DB.get('artist_activities') || [];
                const myActs = activities.filter(act => act.artist_id === ArtistApp.user.id);
                ArtistApp.myScore = myActs.reduce((sum, act) => sum + (parseInt(act.auto_score) || 0), 0);
                document.getElementById('sidebarPointsVal').innerText = ArtistApp.myScore;
                document.getElementById('topPointsVal').innerText = ArtistApp.myScore;
            },

            switchTab: (tabId, e) => {
                if(window.innerWidth <= 992) ArtistApp.toggleSidebar(); 
                document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
                if (e) e.currentTarget.classList.add('active');
                document.querySelectorAll('.dashboard-tab').forEach(el => el.classList.remove('active'));
                document.getElementById(tabId).classList.add('active');
            },

            checkLeaveStatus: async () => {
                const today = new Date().toISOString().split('T')[0];
                const { data: leaves } = await supabaseClient.from('member_leave_requests').select('*').eq('mobile', ArtistApp.user.mobile_number).eq('status', 'Approved');
                if (leaves && leaves.length > 0) {
                    const onLeave = leaves.some(l => today >= l.leave_from && today <= l.leave_to);
                    if (onLeave) {
                        document.getElementById('sidebarLeaveBadge').style.display = 'inline-block';
                        document.getElementById('globalLeaveBanner').style.display = 'block';
                    }
                }
            },

            checkBirthday: () => {
                const u = ArtistApp.user;
                if (!u || !u.dob) return;
                const today = new Date();
                const monthDay = String(today.getMonth() + 1).padStart(2, '0') + '-' + String(today.getDate()).padStart(2, '0');
                
                if (u.dob.substring(5) === monthDay) {
                    document.body.classList.add('birthday-mode');
                    spawnConfetti();

                    if(sessionStorage.getItem('birthday_wished')) return;
                    sessionStorage.setItem('birthday_wished', 'true');

                    UI.showModal('Birthday', `
                        <div style="text-align: center; padding: 20px;">
                            <div style="font-size: 80px; animation: floatIcon 2s ease-in-out infinite alternate;">🎈</div>
                            <h2 style="color: var(--gold); font-size: 32px; margin-top: 16px; font-family: var(--font-heading);">Happy Birthday, ${u.name.split(' ')[0]}!</h2>
                            <p style="color: var(--primary); margin-top: 12px; font-size: 15px; font-weight: 500; line-height: 1.6;">Wishing you a fantastic day filled with joy and creativity. Thank you for being an amazing part of Chinnapatra!</p>
                            <button class="btn btn-primary" style="margin-top: 32px; padding: 14px 40px; width:100%;" onclick="UI.closeModal()">Thank You! ✨</button>
                        </div>
                    `);
                }
            },

            loadWork: async () => {
    const container = document.getElementById('workContainer');
    
    // ১. Premium Loading State
    container.innerHTML = `
        <div style="grid-column: 1/-1; text-align: center; padding: 80px 20px;">
            <i class="ph-fill ph-spinner-gap ph-spin" style="font-size: 48px; color: var(--gold);"></i>
            <p style="color: var(--primary); font-size: 15px; margin-top: 16px; font-weight: 600; letter-spacing: 0.5px; animation: pulse 2s infinite;">Loading your creative tasks...</p>
        </div>
    `;

    const workflows = await DB.get('media_workflows');
    if (!workflows) {
        container.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: var(--danger); padding: 40px; background: #FEE2E2; border-radius: var(--radius-md);">Failed to load tasks. Please try again later.</div>`;
        return;
    }

    const myWork = workflows.filter(w => {
        if (!w.artists_data) return false;
        try {
            const artistsArr = typeof w.artists_data === 'string' ? JSON.parse(w.artists_data) : w.artists_data;
            return artistsArr.some(a => a.artist_id === ArtistApp.user.id || a.artist_name === ArtistApp.user.name); 
        } catch(e) {
            return false;
        }
    }).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

    if (myWork.length === 0) {
        container.innerHTML = `
            <div style="grid-column: 1/-1; padding: 80px 20px; text-align: center; border: 2px dashed #E5E7EB; border-radius: var(--radius-lg); background: var(--white); animation: fadeIn 0.8s cubic-bezier(0.16, 1, 0.3, 1);">
                <div style="width: 80px; height: 80px; background: rgba(212, 175, 55, 0.1); border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 24px; animation: floatIcon 3s infinite alternate;">
                    <i class="ph-fill ph-paint-brush" style="font-size: 40px; color: var(--gold);"></i>
                </div>
                <h3 style="color: var(--primary); font-size: 26px; font-family: var(--font-heading); margin-bottom: 8px;">No Tasks Assigned</h3>
                <p style="color: var(--text-muted); font-size: 15px; font-weight: 500;">You're all caught up! Take a break or explore the Digital Vault.</p>
            </div>`;
        return;
    }

    // ২. Inject Premium CSS for Timeline & Cards
    let html = `
    <style>
        @keyframes scanlinePremium { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
        @keyframes fillTimeline { from { width: 0%; } }
        @keyframes pulseGlowGold { 0% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0.5); } 70% { box-shadow: 0 0 0 10px rgba(212, 175, 55, 0); } 100% { box-shadow: 0 0 0 0 rgba(212, 175, 55, 0); } }
        
        .artist-task-card {
            position: relative;
            background: var(--white);
            border: 1px solid rgba(10, 17, 40, 0.05);
            border-radius: 16px;
            padding: 24px;
            overflow: hidden;
            transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
            box-shadow: 0 4px 15px rgba(0,0,0,0.03);
        }
        .artist-task-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 20px 40px rgba(10, 17, 40, 0.08);
            border-color: rgba(212, 175, 55, 0.3);
        }
        .card-accent-line {
            position: absolute; top: 0; left: 0; right: 0; height: 4px; z-index: 2;
        }
        .card-accent-line::after {
            content: ''; position: absolute; top: 0; left: 0; width: 50%; height: 100%;
            background: linear-gradient(90deg, transparent, rgba(255,255,255,0.8), transparent);
            animation: scanlinePremium 2s cubic-bezier(0.4, 0, 0.2, 1) infinite;
        }
        .platform-box {
            padding: 12px 16px; border-radius: 12px; display: flex; align-items: center; justify-content: space-between; transition: 0.3s; margin-bottom: 10px; cursor: default;
        }
        .platform-box:hover { transform: scale(1.02); }
        .node-active { animation: pulseGlowGold 2s infinite; border-color: var(--gold) !important; background: var(--white) !important; color: var(--gold) !important; }
        .node-done { background: var(--gold) !important; color: var(--white) !important; border-color: var(--gold) !important; }
        .node-future { background: var(--bg-main) !important; color: #9CA3AF !important; border-color: #E5E7EB !important; }
    </style>`;

    // Kolkata Time Formatter helper
    const formatTimeKolkata = (isoStr) => {
        if(!isoStr) return '';
        return new Date(new Date(isoStr).toLocaleString("en-US", {timeZone: "Asia/Kolkata"}))
            .toLocaleString('en-IN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: true });
    };

    myWork.forEach((w, i) => {
        const isCompleted = w.status === 'Posted';
        const isScheduled = w.status === 'Scheduled' || isCompleted;
        
        // Timeline Width Calculation
        let progressWidth = '15%'; // Default Pending
        let step2Class = 'node-future'; let step2Icon = 'ph-calendar-plus';
        let step3Class = 'node-future'; let step3Icon = 'ph-lock-key';

        if (w.status === 'Pending Schedule') {
            progressWidth = '15%';
            step2Class = 'node-active'; step2Icon = 'ph-spinner ph-spin';
        } else if (w.status === 'Scheduled') {
            progressWidth = '50%';
            step2Class = 'node-done'; step2Icon = 'ph-calendar-check';
            step3Class = 'node-active'; step3Icon = 'ph-spinner ph-spin';
        } else if (isCompleted) {
            progressWidth = '100%';
            step2Class = 'node-done'; step2Icon = 'ph-calendar-check';
            step3Class = 'node-done'; step3Icon = 'ph-check-circle';
        }

        const cardTopColor = isCompleted ? 'var(--success)' : 'var(--gold)';

        // --- PLATFORM & TIME RENDERING (FB & INSTA) ---
        let platformUI = '';
        const timeLabel = isCompleted ? 'Live On' : 'Scheduled For';

        if (w.fb_time) {
            platformUI += `
                <div class="platform-box" style="background: rgba(24,119,242,0.05); border: 1px solid rgba(24,119,242,0.15);">
                    <div style="display:flex; align-items:center; gap:8px; color: #1877F2; font-weight: 800; font-size: 14px;">
                        <i class="ph-fill ph-facebook-logo" style="font-size:24px;"></i> Facebook
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #1877F2; font-weight: 700; text-transform: uppercase; opacity: 0.8;">${timeLabel}</div>
                        <div style="color: var(--text-dark); font-weight: 700; font-size: 13px;">${formatTimeKolkata(w.fb_time)}</div>
                    </div>
                </div>`;
        }
        if (w.insta_time) {
            platformUI += `
                <div class="platform-box" style="background: rgba(225,48,108,0.05); border: 1px solid rgba(225,48,108,0.15);">
                    <div style="display:flex; align-items:center; gap:8px; color: #E1306C; font-weight: 800; font-size: 14px;">
                        <i class="ph-fill ph-instagram-logo" style="font-size:24px;"></i> Instagram
                    </div>
                    <div style="text-align: right;">
                        <div style="font-size: 10px; color: #E1306C; font-weight: 700; text-transform: uppercase; opacity: 0.8;">${timeLabel}</div>
                        <div style="color: var(--text-dark); font-weight: 700; font-size: 13px;">${formatTimeKolkata(w.insta_time)}</div>
                    </div>
                </div>`;
        }
        
        // Fallback if no specific time is scheduled yet
        if (!platformUI) {
            platformUI = `
                <div style="text-align: center; padding: 16px; background: var(--bg-main); border-radius: 12px; border: 1px dashed #E5E7EB; color: var(--text-muted); font-size: 13px; font-weight: 500;">
                    <i class="ph-fill ph-clock" style="font-size: 20px; color: var(--gold); margin-bottom: 4px;"></i><br>
                    Schedule Pending from PR Team
                </div>`;
        }

        html += `
            <div class="artist-task-card" style="animation: fadeUp 0.6s forwards; opacity:0; animation-delay: ${i*0.1}s;">
                <div class="card-accent-line" style="background-color: ${cardTopColor};"></div>
                
                <!-- Card Header -->
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 20px;">
                    <div>
                        <span style="background: rgba(10,17,40,0.05); padding: 4px 10px; border-radius: 6px; font-size: 11px; font-weight: 800; color: var(--text-muted); letter-spacing: 1px; display: inline-block; margin-bottom: 8px;">
                            ID: ${w.work_id}
                        </span>
                        <h3 style="font-size: 20px; color: var(--primary); font-family: var(--font-heading); line-height: 1.3; margin: 0;">${w.title}</h3>
                    </div>
                    <span class="badge ${isCompleted ? 'badge-success' : 'badge-pending'}" style="flex-shrink: 0; font-size: 11px;">
                        ${w.status}
                    </span>
                </div>

                <!-- Animated Timeline Tracker -->
                <div style="position: relative; margin: 32px 0; padding: 0 10px;">
                    <!-- Background Line -->
                    <div style="position: absolute; top: 16px; left: 10px; right: 10px; height: 4px; background: #E5E7EB; border-radius: 4px; z-index: 1;"></div>
                    <!-- Animated Fill Line -->
                    <div style="position: absolute; top: 16px; left: 10px; width: ${progressWidth}; height: 4px; background: var(--gold); border-radius: 4px; z-index: 2; animation: fillTimeline 1.5s ease-out forwards;"></div>
                    
                    <div style="display: flex; justify-content: space-between; position: relative; z-index: 3;">
                        <!-- Step 1: Content Created -->
                        <div style="display: flex; flex-direction: column; align-items: center; width: 33%;">
                            <div class="node-done" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid; display: flex; justify-content: center; align-items: center; font-size: 16px; margin-bottom: 8px; background: var(--white); box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                                <i class="ph-bold ph-palette"></i>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: var(--primary); text-transform: uppercase;">Created</span>
                        </div>

                        <!-- Step 2: Scheduled -->
                        <div style="display: flex; flex-direction: column; align-items: center; width: 33%;">
                            <div class="${step2Class}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid; display: flex; justify-content: center; align-items: center; font-size: 16px; margin-bottom: 8px; background: var(--white); transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                                <i class="ph-bold ${step2Icon}"></i>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: ${w.status === 'Pending Schedule' ? 'var(--gold)' : 'var(--primary)'}; text-transform: uppercase;">Scheduled</span>
                        </div>

                        <!-- Step 3: Published -->
                        <div style="display: flex; flex-direction: column; align-items: center; width: 33%;">
                            <div class="${step3Class}" style="width: 36px; height: 36px; border-radius: 50%; border: 2px solid; display: flex; justify-content: center; align-items: center; font-size: 16px; margin-bottom: 8px; background: var(--white); transition: 0.3s; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
                                <i class="ph-bold ${step3Icon}"></i>
                            </div>
                            <span style="font-size: 11px; font-weight: 700; color: ${isCompleted ? 'var(--primary)' : '#9CA3AF'}; text-transform: uppercase;">Published</span>
                        </div>
                    </div>
                </div>

                <!-- Platform Schedules -->
                <div style="margin-bottom: 20px;">
                    <div style="font-size: 11px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; margin-bottom: 12px; letter-spacing: 0.5px;">
                        <i class="ph-bold ph-share-network"></i> Distribution Plan
                    </div>
                    ${platformUI}
                </div>

                <!-- Post Caption Display -->
                ${w.caption ? `
                    <div style="background: rgba(212,175,55,0.05); padding: 16px; border-radius: 12px; border: 1px solid rgba(212,175,55,0.2); position: relative; margin-top: 10px;">
                        <i class="ph-fill ph-quotes" style="position: absolute; top: -10px; left: 16px; color: var(--gold); background: var(--white); padding: 0 8px; font-size: 20px;"></i>
                        <div style="font-size: 13.5px; color: var(--text-dark); line-height: 1.6; font-style: italic; white-space: pre-wrap; margin-top: 4px;">${w.caption}</div>
                    </div>
                ` : ''}
                
            </div>
        `;
    });
    
    container.innerHTML = html;
},
            loadVault: async () => {
                const container = document.getElementById('vaultContainer');
                const links = await DB.get('vault_links') || [];
                if (links.length === 0) {
                    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:60px; color:var(--text-muted); border: 2px dashed #E5E7EB; border-radius: var(--radius-lg); background: var(--white);">No assets available in the vault yet.</div>';
                    return;
                }

                // Relying on the same dynamic CSS injected by loadWork if called together, or safely re-injecting
                let html = '';
                links.forEach((l, i) => {
                    html += `
                        <div class="glass-card animated-border-card" style="padding: 32px; animation: fadeUp 0.6s forwards; opacity:0; animation-delay: ${i*0.1}s; position: relative;">
                            <div class="card-top-line" style="background-color: var(--primary);"></div>
                            <div style="width: 56px; height: 56px; background: rgba(10, 17, 40, 0.05); color: var(--primary); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 20px;">
                                <i class="ph-fill ph-google-drive-logo"></i>
                            </div>
                            <h3 style="font-size: 18px; margin-bottom: 16px;">${l.title}</h3>
                            <a href="${l.url}" target="_blank" class="btn btn-outline" style="width: 100%; display: flex; justify-content: center; gap: 8px;">
                                Access Securely <i class="ph-bold ph-arrow-square-out"></i>
                            </a>
                        </div>
                    `;
                });
                container.innerHTML = html;
            },
            loadLeaderboard: async () => {
                const listContainer = document.getElementById('leaderboardList');
                const podium = document.getElementById('podiumContainer');
                
                const artists = await DB.get('artists') || [];
                const activities = await DB.get('artist_activities') || [];

                let leaderboard = artists.map(a => {
                    const myActs = activities.filter(act => act.artist_id === a.id);
                    const score = myActs.reduce((sum, act) => sum + (parseInt(act.auto_score) || 0), 0);
                    return { ...a, score };
                }).filter(a => a.score > 0).sort((a, b) => b.score - a.score);

                // --- 1. Render Premium Podium (Top 3) Solid Colors ---
                let podiumHtml = '';
                const places = [
                    { rank: 2, height: '140px', bg: '#9CA3AF', border: '#D1D5DB', obj: leaderboard[1] },
                    { rank: 1, height: '180px', bg: 'var(--gold)', border: '#FDE047', obj: leaderboard[0] },
                    { rank: 3, height: '110px', bg: '#B45309', border: '#D97706', obj: leaderboard[2] }
                ];

                places.forEach(p => {
                    if (!p.obj) return;
                    const isMe = p.obj.name === ArtistApp.user.name; 
                    const nameColor = isMe ? 'var(--gold)' : 'var(--primary)';
                    const crown = p.rank === 1 ? '<i class="ph-fill ph-crown" style="color:var(--gold); font-size:44px; position:absolute; top:-40px; text-shadow: 0 4px 10px rgba(212,175,55,0.3);"></i>' : '';
                    let avatarContent = p.obj.image_link ? `<img src="${p.obj.image_link}">` : p.obj.name.charAt(0);

                    podiumHtml += `
                        <div class="podium-step">
                            <div style="position:relative; display:flex; justify-content:center;">
                                ${crown}
                                <div class="podium-avatar" style="border-color: ${p.border};">${avatarContent}</div>
                            </div>
                            <div style="font-size: 14px; font-weight: 700; color: ${nameColor}; text-align:center; margin-bottom: 4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:120px;">${p.obj.name.split(' ')[0]}</div>
                            <div style="font-size: 12px; font-weight: 800; color:var(--text-muted); margin-bottom: 16px; background: #F3F4F6; padding: 4px 10px; border-radius: 12px;">${p.obj.score} Pts</div>
                            <div class="podium-box" style="height: ${p.height}; background: ${p.bg};"><span style="font-size: 40px; font-weight: 800; color: var(--white);">${p.rank}</span></div>
                        </div>
                    `;
                });
                podium.innerHTML = podiumHtml;

                // --- 2. Render Premium List Cards (Rank 4+) ---
                let listHtml = '';
                leaderboard.forEach((a, index) => {
                    if (index < 3) return; 
                    const isMe = a.name === ArtistApp.user.name;
                    const meClass = isMe ? 'is-me' : '';
                    let tAvatar = a.image_link ? `<img src="${a.image_link}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-size:18px; font-weight:bold;">${a.name.charAt(0)}</div>`;
                    
                    listHtml += `
                        <div class="leaderboard-card ${meClass}" style="animation-delay: ${(index-3)*0.1}s;">
                            <div style="display: flex; align-items: center; gap: 20px;">
                                <div style="font-weight: 800; font-size: 20px; color: var(--text-muted); width: 40px;">#${index + 1}</div>
                                <div style="width: 50px; height: 50px; border-radius: 50%; overflow: hidden; border: 2px solid #E5E7EB;">${tAvatar}</div>
                                <div><div style="font-weight: 700; font-size: 16px; color: var(--primary); font-family: var(--font-heading);">${a.name} ${isMe ? '<span class="badge badge-success" style="font-size:10px; padding:2px 6px; margin-left:8px;">YOU</span>' : ''}</div></div>
                            </div>
                            <div style="font-weight: 800; font-size: 20px; color: var(--gold);">${a.score} <span style="font-size: 12px; color: var(--text-muted);">Pts</span></div>
                        </div>
                    `;
                });
                
                listContainer.innerHTML = listHtml || (leaderboard.length <= 3 ? '<div class="text-center text-muted" style="padding: 40px; background: var(--white); border-radius: var(--radius-lg); border: 1px dashed #E5E7EB;">No other ranked artists yet.</div>' : '');
            },

            // --- 1:1 EXACT HTML PRINT DOWNLOAD FOR ID CARD ---
            downloadIDCardPDF: () => {
                const u = ArtistApp.user;
                const shortId = (u.id || '').substring(0, 6).toUpperCase();
                const avatarHtml = u.image_link ? `<img src="${u.image_link}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="font-size:40px; font-weight:bold; color:#0A1128;">${u.name.charAt(0)}</div>`;

                let printWindow = window.open('', '_blank');
                let html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Chinnapatra_ID_${shortId}</title>
                        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Poppins:wght@500;600;700&display=swap" rel="stylesheet">
                        <style>
                            body { margin:0; padding:40px; display:flex; justify-content:center; align-items:center; background:#ffffff; font-family:'Poppins', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .id-card { width: 340px; background: #0A1128; border-radius: 24px; overflow: hidden; border: 2px solid #D4AF37; color: white; box-shadow: 0 10px 40px rgba(0,0,0,0.2); }
                            .header { background: #1A2442; padding: 24px; text-align: center; border-bottom: 2px solid #D4AF37; }
                            .header h3 { color: #D4AF37; font-family: 'Playfair Display', serif; font-size: 26px; margin: 0; letter-spacing: 1px;}
                            .header p { font-size: 10px; color: #9CA3AF; letter-spacing: 3px; text-transform: uppercase; margin-top: 6px; font-weight: 600;}
                            .body { padding: 32px 24px; text-align: center; background: #0A1128; }
                            .avatar { width: 110px; height: 110px; border-radius: 50%; border: 4px solid #D4AF37; margin: 0 auto 20px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                            .name { font-size: 24px; font-weight: 700; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                            .role { color: #D4AF37; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 24px; }
                            .details { background: #1A2442; padding: 18px; border-radius: 12px; text-align: left; font-size: 12px; }
                            .details div { display: flex; justify-content: space-between; margin-bottom: 10px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px; }
                            .details div:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
                            .details span.label { color: #9CA3AF; }
                            .details span.val { font-weight: 600; color: #fff;}
                            .footer { text-align: center; padding: 16px; background: #1A2442; font-size: 10px; color: #9CA3AF; font-weight: 600; letter-spacing: 1px; border-top: 1px solid rgba(255,255,255,0.05); }
                            @media print {
                                body { padding:0; background:none; }
                                @page { size: portrait; margin: 10mm; }
                            }
                        </style>
                    </head>
                    <body>
                        <div class="id-card">
                            <div class="header">
                                <h3>CHINNAPATRA</h3>
                                <p>Official Artist Identity</p>
                            </div>
                            <div class="body">
                                <div class="avatar">${avatarHtml}</div>
                                <div class="name">${u.name}</div>
                                <div class="role">${u.department || 'Creative Team'}</div>
                                <div class="details">
                                    <div><span class="label">Artist ID</span> <span class="val">${shortId}</span></div>
                                    <div><span class="label">D.O.B</span> <span class="val">${u.dob || 'N/A'}</span></div>
                                    <div><span class="label">Mobile</span> <span class="val">${u.mobile_number || 'N/A'}</span></div>
                                </div>
                            </div>
                            <div class="footer">AUTHORIZED BY CHINNAPATRA ADMIN</div>
                        </div>
                        <script>
                            window.onload = function() { setTimeout(() => { window.print(); }, 500); }
                        <\/script>
                    </body>
                    </html>
                `;
                printWindow.document.write(html);
                printWindow.document.close();
            },

            // --- SUPPORT & GRIEVANCE ---
            selectedGrievanceFiles: [],
            handleFiles: (input) => {
                const files = Array.from(input.files);
                const dropzone = document.getElementById('dropzone');
                const previewArea = document.getElementById('previewArea');
                const statusText = document.getElementById('uploadStatusText');

                if (files.length + ArtistApp.selectedGrievanceFiles.length > 5) {
                    UI.showToast("Max 5 images allowed.", "error");
                    input.value = ""; return;
                }
                
                files.forEach(file => {
                    if (file.type.startsWith('image/')) {
                        ArtistApp.selectedGrievanceFiles.push(file);
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            previewArea.innerHTML += `<div class="preview-img-container"><img src="${e.target.result}" class="preview-img"></div>`;
                        }
                        reader.readAsDataURL(file);
                    }
                });

                if (ArtistApp.selectedGrievanceFiles.length > 0) {
                    dropzone.classList.add('has-files');
                    document.getElementById('uploadIcon').style.display = 'none';
                    document.getElementById('uploadText').innerText = `${ArtistApp.selectedGrievanceFiles.length} file(s) selected`;
                    statusText.style.display = 'block';
                }
            },
            submitGrievance: async (e) => {
                e.preventDefault();
                const btn = e.target.querySelector('button');
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Processing...'; btn.disabled = true;

                try {
                    let imageUrls = [];
                    if (ArtistApp.selectedGrievanceFiles.length > 0) {
                        for (let file of ArtistApp.selectedGrievanceFiles) {
                            const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${file.name.split('.').pop()}`;
                            const { data, error } = await supabaseClient.storage.from('complaints').upload(fileName, file);
                            if (error) throw new Error("Image upload failed.");
                            const pubUrl = supabaseClient.storage.from('complaints').getPublicUrl(fileName).data.publicUrl;
                            imageUrls.push(pubUrl);
                        }
                    }

                    const manualUrl = document.getElementById('gImageUrl').value;
                    if(manualUrl) imageUrls.push(manualUrl);

                    const payload = {
                        member_name: ArtistApp.user.name,
                        email: document.getElementById('gEmail').value,
                        mobile: ArtistApp.user.mobile_number || 'N/A',
                        member_id: ArtistApp.user.id,
                        complaint_text: document.getElementById('gText').value,
                        images: imageUrls,
                        status: 'Pending'
                    };

                    const { error: dbError } = await supabaseClient.from('member_complaints').insert([payload]);
                    if (dbError) throw dbError;
                    
                    UI.showToast('Ticket submitted successfully!', 'success');
                    e.target.reset();
                    
                    ArtistApp.selectedGrievanceFiles = [];
                    document.getElementById('dropzone').classList.remove('has-files');
                    document.getElementById('uploadIcon').style.display = 'inline-block';
                    document.getElementById('uploadText').innerText = 'Click to select files (.jpg, .png)';
                    document.getElementById('uploadStatusText').style.display = 'none';
                    document.getElementById('previewArea').innerHTML = '';
                    
                    document.getElementById('gName').value = ArtistApp.user.name;
                    document.getElementById('gId').value = (ArtistApp.user.id || '').substring(0, 6).toUpperCase();
                    document.getElementById('gMobile').value = ArtistApp.user.mobile_number || '';
                    
                    ArtistApp.loadGrievances();

                } catch (err) {
                    console.error(err);
                    UI.showToast(`Error: ${err.message}`, 'error');
                } finally {
                    btn.innerHTML = orig; btn.disabled = false;
                }
            },
            loadGrievances: async () => {
                const container = document.getElementById('grievanceHistoryContainer');
                const { data: issues, error } = await supabaseClient.from('member_complaints').select('*').eq('member_id', ArtistApp.user.id).order('created_at', { ascending: false });

                if (error || !issues || issues.length === 0) {
                    container.innerHTML = '<div style="padding: 40px; border: 2px dashed #E5E7EB; border-radius: var(--radius-lg); text-align: center; color: var(--text-muted); background: var(--white);">No tickets filed.</div>';
                    return;
                }

                let html = '';
                issues.forEach((i, idx) => {
                    const statusClass = i.status === 'Resolved' ? 'badge-success' : (i.status === 'Reviewed' ? 'badge-pending' : 'badge-danger');
                    const dateStr = new Date(i.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                    let attachHtml = '';
                    if (i.images && i.images.length > 0) {
                        attachHtml = `<div style="margin-top:16px; display:flex; gap:12px; flex-wrap:wrap;">`;
                        i.images.forEach((img, jdx) => { attachHtml += `<a href="${img}" target="_blank" style="font-size:12px; color:var(--primary); background:#F3F4F6; border:1px solid #E5E7EB; padding:6px 12px; border-radius:6px; font-weight:600; text-decoration:none; display:flex; align-items:center; gap:6px; transition:var(--transition);"><i class="ph-bold ph-image"></i> File ${jdx+1}</a>`; });
                        attachHtml += `</div>`;
                    }

                    html += `
                        <div class="glass-card" style="padding: 24px; border-left: 6px solid var(--primary); animation: fadeUp 0.5s forwards; opacity:0; animation-delay:${idx*0.1}s;">
                            <div style="display:flex; justify-content:space-between; align-items: center; margin-bottom:12px;">
                                <div style="font-size: 12px; font-weight: 700; color: var(--text-muted); display:flex; align-items:center; gap:6px;"><i class="ph-bold ph-calendar"></i> ${dateStr}</div>
                                <span class="badge ${statusClass}">${i.status}</span>
                            </div>
                            <div style="font-size: 14px; color: var(--text-dark); line-height: 1.6; white-space: pre-wrap; font-weight:500;">${i.complaint_text}</div>
                            ${attachHtml}
                        </div>
                    `;
                });
                container.innerHTML = html;
            },

            // --- LEAVES ---
            calcDays: () => {
                const f = document.getElementById('leaveFrom').value; 
                const t = document.getElementById('leaveTo').value;
                if (f && t) document.getElementById('leaveDays').innerText = Math.max(0, Math.ceil((new Date(t) - new Date(f)) / 86400000) + 1);
            },
            submitLeave: async (e) => {
                e.preventDefault();
                const days = parseInt(document.getElementById('leaveDays').innerText);
                if (days <= 0) return UI.showToast('Invalid date range', 'error');

                const btn = e.target.querySelector('button');
                const orig = btn.innerHTML;
                btn.innerHTML = '<i class="ph ph-spinner ph-spin"></i> Submitting...'; btn.disabled = true;

                await DB.insert('member_leave_requests', {
                    member_name: `${ArtistApp.user.name} (${ArtistApp.user.department || 'General'})`,
                    mobile: ArtistApp.user.mobile_number || 'N/A',
                    leave_from: document.getElementById('leaveFrom').value,
                    leave_to: document.getElementById('leaveTo').value,
                    total_days: days,
                    reason: document.getElementById('leaveReason').value,
                    status: 'Pending'
                });

                btn.innerHTML = orig; btn.disabled = false;
                UI.showToast('Leave request submitted!', 'success');
                e.target.reset(); document.getElementById('leaveDays').innerText = '0';
                
                ArtistApp.loadLeaves();
                ArtistApp.switchTab('tab-leave-history');
            },
            loadLeaves: async () => {
                const tbody = document.getElementById('leaveHistoryBody');
                const leaves = await DB.get('member_leave_requests');
                if (!leaves) return;

                const myLeaves = leaves.filter(l => l.member_name.startsWith(ArtistApp.user.name));
                let html = '';
                myLeaves.forEach((l, idx) => {
                    const statusClass = l.status === 'Approved' ? 'badge-success' : (l.status === 'Rejected' ? 'badge-danger' : 'badge-pending');
                    html += `<tr style="border-bottom: 1px solid #F3F4F6; animation: fadeIn 0.4s forwards; animation-delay:${idx*0.1}s; opacity:0;">
                                <td style="padding: 20px; font-size: 14px;"><strong>${l.leave_from}</strong><br><span style="color:var(--text-muted); font-size:12px;">to</span><br><strong>${l.leave_to}</strong></td>
                                <td style="padding: 20px;"><div style="background: var(--primary); color: var(--gold); width: 44px; height: 44px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700; font-size: 16px;">${l.total_days}</div></td>
                                <td style="padding: 20px; font-size: 14px; font-style: italic; color: var(--text-dark); max-width: 300px;">"${l.reason}"</td>
                                <td style="padding: 20px;"><span class="badge ${statusClass}">${l.status}</span></td>
                             </tr>`;
                });
                tbody.innerHTML = html || '<tr><td colspan="4" style="text-align:center; padding:40px; color:var(--text-muted); background:var(--white);">No leave history recorded.</td></tr>';
            }
        };
        
        const AutoRefresh = {
            intervalId: null,
            
            start: (interval = 30000) => { // 30 seconds
                if (AutoRefresh.intervalId) clearInterval(AutoRefresh.intervalId);
                
                console.log(`Auto Refresh Activated: Syncing every ${interval / 1000} seconds.`);
                
                AutoRefresh.intervalId = setInterval(async () => {
                    // Modal Protection: Prevent refresh if user is interacting with forms
                    const modal = document.getElementById('mainModal');
                    if (modal && modal.classList.contains('active')) {
                        console.log("Auto-Refresh paused: User is typing in a modal.");
                        return;
                    }

                    try {
                        // Refresh Artist App Data
                        if (typeof ArtistApp !== 'undefined' && ArtistApp.user) {
                            await ArtistApp.calculateMyPoints();
                            
                            // Prevent full screen flashing by only calling if on specific tabs
                            if(document.getElementById('tab-work').classList.contains('active')) {
                                ArtistApp.loadWork(); 
                            }
                            ArtistApp.loadNotifications(); 
                        }
                        
                        // Refresh Media PR App Data (if applicable)
                        if (typeof MediaPR !== 'undefined' && (MediaPR.user || App.currentUser)) {
                            const newWorkflows = await DB.get('media_workflows');
                            if (newWorkflows) {
                                MediaPR.myTasks = newWorkflows;
                                const wrapper = document.getElementById('prMediaCardsWrapper');
                                if (wrapper && wrapper.closest('.dashboard-tab.active')) {
                                    MediaPR.renderTasks(); 
                                }
                            }
                        }
                    } catch (error) {
                        console.warn("Auto-Refresh Silent Error:", error.message);
                    }
                }, interval);
            },

            stop: () => {
                if (AutoRefresh.intervalId) {
                    clearInterval(AutoRefresh.intervalId);
                    AutoRefresh.intervalId = null;
                    console.log("Auto Refresh Stopped.");
                }
            }
        };

        window.onload = () => { ArtistApp.init(); };
