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
                toast.innerHTML = `<i class="ph-fill ${type === 'error' ? 'ph-x-circle' : 'ph-check-circle'}" style="font-size: 24px; color: ${type === 'error' ? 'var(--danger)' : 'var(--success)'};"></i> <span>${msg}</span>`;
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
            const colors = ['#c89b3c', '#e8dfc8', '#0b1938', '#ef4444', '#10b981'];
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
                btn.innerHTML = 'Verify & Continue'; btn.disabled = false;

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
                btn.innerHTML = 'Save Password & Login'; btn.disabled = false;

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

            toggleSidebar: () => { document.getElementById('sidebar').classList.toggle('active'); },
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

                document.getElementById('currentDateDisplay').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

                // Truncate ID to first 6 characters
                const shortId = (ArtistApp.user.id || '').substring(0, 6).toUpperCase();

                document.getElementById('sidebarName').innerText = ArtistApp.user.name;
                document.getElementById('sidebarDept').innerText = ArtistApp.user.department || 'General Team';
                
                const avatarContent = ArtistApp.user.image_link ? `<img src="${ArtistApp.user.image_link}">` : ArtistApp.user.name.charAt(0);
                document.getElementById('sidebarAvatar').innerHTML = avatarContent;
                document.getElementById('idCardAvatar').innerHTML = avatarContent;
                
                document.getElementById('idCardName').innerText = ArtistApp.user.name;
                document.getElementById('idCardDept').innerText = ArtistApp.user.department || 'Creative Team';
                document.getElementById('idCardId').innerText = shortId; 
                document.getElementById('idCardDob').innerText = ArtistApp.user.dob || '--/--/----';
                document.getElementById('idCardMob').innerText = ArtistApp.user.mobile_number || 'N/A';

                document.getElementById('gName').value = ArtistApp.user.name;
                document.getElementById('gId').value = shortId;
                document.getElementById('gMobile').value = ArtistApp.user.mobile_number || '';
                if(ArtistApp.user.email) document.getElementById('gEmail').value = ArtistApp.user.email;

                await ArtistApp.calculateMyPoints();
                ArtistApp.checkLeaveStatus();
                ArtistApp.checkBirthday();
                ArtistApp.loadWork();
                ArtistApp.loadLeaves();
                ArtistApp.loadVault();
                ArtistApp.loadLeaderboard();
                ArtistApp.loadGrievances();
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
                            <h2 style="color: var(--gold); font-size: 28px; margin-top: 16px; font-family: var(--font-heading);">Happy Birthday, ${u.name.split(' ')[0]}!</h2>
                            <p style="color: var(--primary); margin-top: 12px; font-size: 15px; font-weight: 500;">Wishing you a fantastic day filled with joy and creativity. Thank you for being an amazing part of Chinnapatra!</p>
                            <button class="btn btn-primary ripple-btn" style="margin-top: 24px; padding: 12px 32px; width:100%;" onclick="UI.closeModal()">Thank You! ✨</button>
                        </div>
                    `);
                }
            },

            loadWork: async () => {
                const container = document.getElementById('workContainer');
                const workflows = await DB.get('media_workflows');
                if (!workflows) return;

                const myWork = workflows.filter(w => {
                    if (!w.artists_data) return false;
                    const artistsArr = typeof w.artists_data === 'string' ? JSON.parse(w.artists_data) : w.artists_data;
                    return artistsArr.some(a => a.artist_id === ArtistApp.user.id || a.artist_name === ArtistApp.user.name); 
                }).sort((a,b) => new Date(b.created_at) - new Date(a.created_at));

                if (myWork.length === 0) {
                    container.innerHTML = `<div style="grid-column: 1/-1; padding: 60px 20px; text-align: center; border: 2px dashed rgba(200,155,60,0.3); border-radius: var(--radius-lg); background: rgba(255,255,255,0.5);"><h3 style="color: var(--primary);">No Tasks Assigned</h3><p style="color: var(--text-muted);">You're all caught up!</p></div>`;
                    return;
                }

                let html = '';
                myWork.forEach((w, i) => {
                    const isCompleted = w.status === 'Posted';
                    html += `
                        <div class="glass-card" style="animation-delay: ${i*0.1}s; padding:20px; border-top: 4px solid ${isCompleted ? 'var(--success)' : 'var(--gold)'};">
                            <div style="display:flex; justify-content:space-between; margin-bottom:12px;">
                                <div><span style="font-size:11px; font-weight:bold; color:var(--text-muted);">${w.work_id}</span><h3 style="font-size:18px;">${w.title}</h3></div>
                                <span class="badge ${isCompleted ? 'badge-success' : 'badge-pending'}">${w.status}</span>
                            </div>
                            <div style="font-size:12px; color:var(--text-muted);">Platform: ${w.platform || 'Pending'}</div>
                        </div>
                    `;
                });
                container.innerHTML = html;
            },

            loadVault: async () => {
                const container = document.getElementById('vaultContainer');
                const links = await DB.get('vault_links') || [];
                if (links.length === 0) {
                    container.innerHTML = '<div style="grid-column:1/-1; text-align:center; padding:40px; color:var(--text-muted); border: 2px dashed rgba(0,0,0,0.1); border-radius: 12px;">No assets available in the vault yet.</div>';
                    return;
                }

                let html = '';
                links.forEach(l => {
                    html += `
                        <div class="glass-card" style="padding: 24px; border-top: 4px solid var(--gold);">
                            <div style="width: 50px; height: 50px; background: rgba(200,155,60,0.1); color: var(--gold); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 28px; margin-bottom: 16px;"><i class="ph-fill ph-google-drive-logo"></i></div>
                            <h3 style="font-size: 18px; margin-bottom: 8px;">${l.title}</h3>
                            <a href="${l.url}" target="_blank" class="btn btn-outline" style="width: 100%;">Access Files <i class="ph-bold ph-arrow-square-out"></i></a>
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

                // --- 1. Render Premium Podium (Top 3) ---
                let podiumHtml = '';
                const places = [
                    { rank: 2, height: '140px', grad: 'var(--grad-silver)', border: '#94a3b8', obj: leaderboard[1] },
                    { rank: 1, height: '180px', grad: 'var(--grad-gold)', border: '#fbbf24', obj: leaderboard[0] },
                    { rank: 3, height: '110px', grad: 'var(--grad-bronze)', border: '#b45309', obj: leaderboard[2] }
                ];

                places.forEach(p => {
                    if (!p.obj) return;
                    const isMe = p.obj.name === ArtistApp.user.name; 
                    const nameColor = isMe ? 'var(--gold)' : 'var(--primary)';
                    const crown = p.rank === 1 ? '<i class="ph-fill ph-crown" style="color:#fbbf24; font-size:40px; position:absolute; top:-35px; text-shadow: 0 4px 15px rgba(251,191,36,0.4);"></i>' : '';
                    let avatarContent = p.obj.image_link ? `<img src="${p.obj.image_link}">` : p.obj.name.charAt(0);

                    podiumHtml += `
                        <div class="podium-step">
                            <div style="position:relative; display:flex; justify-content:center;">
                                ${crown}
                                <div class="podium-avatar" style="border-color: ${p.border};">${avatarContent}</div>
                            </div>
                            <div style="font-size: 13px; font-weight: 700; color: ${nameColor}; text-align:center; margin-bottom: 2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; width:110px;">${p.obj.name.split(' ')[0]}</div>
                            <div style="font-size: 11px; font-weight: 800; color:var(--text-muted); margin-bottom: 12px; background: rgba(0,0,0,0.05); padding: 2px 8px; border-radius: 10px;">${p.obj.score} Pts</div>
                            <div class="podium-box" style="height: ${p.height}; background: ${p.grad};"><span style="font-size: 40px; font-weight: 800; color: rgba(255,255,255,0.8); text-shadow: 0 4px 10px rgba(0,0,0,0.15);">${p.rank}</span></div>
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
                    let tAvatar = a.image_link ? `<img src="${a.image_link}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="width:100%; height:100%; background:var(--primary); color:white; display:flex; align-items:center; justify-content:center; font-size:16px; font-weight:bold;">${a.name.charAt(0)}</div>`;
                    
                    listHtml += `
                        <div class="leaderboard-card ${meClass}">
                            <div style="display: flex; align-items: center; gap: 16px;">
                                <div style="font-weight: 800; font-size: 18px; color: var(--text-muted); width: 30px;">#${index + 1}</div>
                                <div style="width: 44px; height: 44px; border-radius: 50%; overflow: hidden; border: 2px solid var(--gold-light);">${tAvatar}</div>
                                <div><div style="font-weight: 700; font-size: 15px; color: var(--primary); font-family: var(--font-heading);">${a.name} ${isMe ? '<span class="badge badge-success" style="font-size:9px; padding:2px 6px; margin-left:6px;">YOU</span>' : ''}</div></div>
                            </div>
                            <div style="font-weight: 800; font-size: 18px; color: var(--gold);">${a.score} <span style="font-size: 11px; color: var(--text-muted);">Pts</span></div>
                        </div>
                    `;
                });
                
                listContainer.innerHTML = listHtml || (leaderboard.length <= 3 ? '<div class="text-center text-muted" style="padding: 20px;">No other ranked artists yet.</div>' : '');
            },

            // --- 1:1 EXACT HTML PRINT DOWNLOAD FOR ID CARD ---
            downloadIDCardPDF: () => {
                const u = ArtistApp.user;
                const shortId = (u.id || '').substring(0, 6).toUpperCase();
                const avatarHtml = u.image_link ? `<img src="${u.image_link}" style="width:100%; height:100%; object-fit:cover;">` : `<div style="font-size:36px; font-weight:bold; color:#0b1938;">${u.name.charAt(0)}</div>`;

                let printWindow = window.open('', '_blank');
                let html = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Chinnapatra_ID_${shortId}</title>
                        <link href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
                        <style>
                            body { margin:0; padding:40px; display:flex; justify-content:center; align-items:center; background:#f4f4f4; font-family:'Poppins', sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                            .id-card { width: 330px; background: #0b1938; border-radius: 20px; overflow: hidden; border: 2px solid #c89b3c; color: white; box-shadow: 0 10px 30px rgba(0,0,0,0.3); }
                            .header { background: rgba(255,255,255,0.05); padding: 18px; text-align: center; border-bottom: 1px solid rgba(200,155,60,0.3); }
                            .header h3 { color: #c89b3c; font-family: 'Playfair Display', serif; font-size: 24px; margin: 0; }
                            .header p { font-size: 9px; color: rgba(255,255,255,0.6); letter-spacing: 2px; text-transform: uppercase; margin-top: 4px; }
                            .body { padding: 24px; text-align: center; }
                            .avatar { width: 90px; height: 90px; border-radius: 50%; border: 3px solid #c89b3c; margin: 0 auto 16px; background: #fff; display: flex; align-items: center; justify-content: center; overflow: hidden; }
                            .name { font-size: 20px; font-weight: 700; font-family: 'Playfair Display', serif; margin-bottom: 4px; }
                            .role { color: #c89b3c; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 20px; }
                            .details { background: rgba(0,0,0,0.3); padding: 14px; border-radius: 12px; text-align: left; font-size: 11px; }
                            .details div { display: flex; justify-content: space-between; margin-bottom: 6px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 4px; }
                            .details div:last-child { margin-bottom: 0; border-bottom: none; padding-bottom: 0; }
                            .details span.label { color: rgba(255,255,255,0.6); }
                            .details span.val { font-weight: 600; }
                            .footer { text-align: center; padding: 12px; background: rgba(0,0,0,0.5); font-size: 9px; color: rgba(255,255,255,0.5); letter-spacing: 1px; }
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
                                    <div><span class="label">Artist ID:</span> <span class="val">${shortId}</span></div>
                                    <div><span class="label">DOB:</span> <span class="val">${u.dob || 'N/A'}</span></div>
                                    <div><span class="label">Mobile:</span> <span class="val">${u.mobile_number || 'N/A'}</span></div>
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
                    
                    UI.showToast('Grievance submitted successfully!', 'success');
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
                    container.innerHTML = '<div style="padding: 20px; border: 1px dashed rgba(0,0,0,0.1); border-radius: 12px; text-align: center; color: var(--text-muted);">No grievances filed.</div>';
                    return;
                }

                let html = '';
                issues.forEach(i => {
                    const statusClass = i.status === 'Resolved' ? 'badge-success' : (i.status === 'Reviewed' ? 'badge-pending' : 'badge-danger');
                    const dateStr = new Date(i.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
                    let attachHtml = '';
                    if (i.images && i.images.length > 0) {
                        attachHtml = `<div style="margin-top:12px; display:flex; gap:8px; flex-wrap:wrap;">`;
                        i.images.forEach((img, idx) => { attachHtml += `<a href="${img}" target="_blank" style="font-size:11px; color:var(--primary); background:rgba(200,155,60,0.1); padding:4px 8px; border-radius:4px; font-weight:600; text-decoration:none;"><i class="ph-bold ph-image"></i> Link ${idx+1}</a>`; });
                        attachHtml += `</div>`;
                    }

                    html += `
                        <div class="glass-card" style="padding: 16px; border-left: 4px solid var(--primary); box-shadow: none; background: rgba(255,255,255,0.9);">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                                <div style="font-size: 11px; font-weight: 700; color: var(--text-muted);"><i class="ph-bold ph-calendar"></i> ${dateStr}</div>
                                <span class="badge ${statusClass}">${i.status}</span>
                            </div>
                            <div style="font-size: 13px; color: var(--text-dark); line-height: 1.5; white-space: pre-wrap;">${i.complaint_text}</div>
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
                myLeaves.forEach(l => {
                    const statusClass = l.status === 'Approved' ? 'badge-success' : (l.status === 'Rejected' ? 'badge-danger' : 'badge-pending');
                    html += `<tr><td><strong>${l.leave_from}</strong> to <strong>${l.leave_to}</strong></td><td><div style="background: rgba(200,155,60,0.1); color: var(--gold); width: 40px; height: 40px; display: flex; align-items: center; justify-content: center; border-radius: 50%; font-weight: 700;">${l.total_days}</div></td><td>"${l.reason}"</td><td><span class="badge ${statusClass}">${l.status}</span></td></tr>`;
                });
                tbody.innerHTML = html || '<tr><td colspan="4" class="text-center text-muted">No leave history.</td></tr>';
            }
        };

        window.onload = () => { ArtistApp.init(); };
    
