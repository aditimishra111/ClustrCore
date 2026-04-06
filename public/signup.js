/* ============================================================
   CLUSTR CORE — SIGNUP JS
   Includes secret-code gate for Team / Admin roles
============================================================ */

const TEAM_ROLES = {
  tech:    ['Lead Developer', 'Backend Developer', 'Frontend Developer', 'DevOps Engineer'],
  events:  ['Event Lead', 'Coordinator', 'Logistics Head', 'Outreach Lead'],
  digital: ['Design Lead', 'Social Media Manager', 'Content Creator'],
};

let selectedRole     = '';
let selectedTeam     = '';
let selectedTeamRole = '';
let photoFile        = null;

/* ── Show banner ── */
function showBanner(msg, type = 'error') {
  const banner = document.getElementById('msgBanner');
  if (!banner) return;
  document.getElementById('msgText').textContent = msg;
  banner.className = `msg-banner ${type} show`;
  setTimeout(() => banner?.classList.remove('show'), 4500);
}

/* ── Loading spinner ── */
function setLoading(on) {
  const submitBtn = document.getElementById('submitBtn');
  const spinner   = document.getElementById('spinner');
  const btnText   = document.getElementById('btnText');
  if (submitBtn) submitBtn.disabled    = on;
  if (spinner)   spinner.style.display = on ? 'block' : 'none';
  if (btnText)   btnText.style.display = on ? 'none'  : 'flex';
}

/* ── ROLE CARDS ── */
document.getElementById('roleGrid')?.addEventListener('click', e => {
  const card = e.target.closest('.role-card');
  if (!card || card.closest('#teamGrid')) return;

  document.querySelectorAll('#roleGrid .role-card').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedRole = card.dataset.role;

  const secretExpand = document.getElementById('secretExpand');
  const secretInput  = document.getElementById('secretCode');
  const tf           = document.getElementById('teamFields');
  const photoGroup   = document.getElementById('photoGroup');
  const socialGroup  = document.getElementById('socialGroup');
  const teamGroup    = document.getElementById('teamGroup');
  const roleGroup    = document.getElementById('roleGroup');

  // ── Show / hide secret code field ──────────────────────
  if (selectedRole === 'team' || selectedRole === 'admin') {
    secretExpand?.classList.add('open');
  } else {
    secretExpand?.classList.remove('open');
    if (secretInput) secretInput.value = '';
  }

  // ── Show / hide team-details section ───────────────────
  if (selectedRole === 'team' || selectedRole === 'admin') {
    tf?.classList.add('open');
    photoGroup?.classList.add('show');

    if (selectedRole === 'admin') {
      if (teamGroup)  teamGroup.style.display  = 'none';
      if (roleGroup)  roleGroup.style.display  = 'none';
      if (socialGroup) socialGroup.style.display = 'none';
    } else {
      // team
      if (teamGroup)  teamGroup.style.display  = '';
      if (roleGroup)  roleGroup.style.display  = '';
      if (socialGroup) socialGroup.style.display = 'block';
    }
  } else {
    // student — clear everything
    tf?.classList.remove('open');
    photoGroup?.classList.remove('show');
    if (socialGroup) socialGroup.style.display = 'none';
    selectedTeam     = '';
    selectedTeamRole = '';
    photoFile        = null;
  }
});

/* ── TEAM GRID ── */
document.getElementById('teamGrid')?.addEventListener('click', e => {
  const card = e.target.closest('.team-opt');
  if (!card) return;

  document.querySelectorAll('.team-opt').forEach(c => c.classList.remove('selected'));
  card.classList.add('selected');
  selectedTeam = card.dataset.team;

  const sel = document.getElementById('teamRole');
  if (sel) {
    const roles = TEAM_ROLES[selectedTeam] || [];
    sel.innerHTML =
      '<option value="">— pick your role —</option>' +
      roles.map(r => `<option value="${r}">${r}</option>`).join('');
    selectedTeamRole = '';
  }
});

document.getElementById('teamRole')?.addEventListener('change', e => {
  selectedTeamRole = e.target.value;
});

/* ── PHOTO UPLOAD ── */
const photoDrop  = document.getElementById('photoDrop');
const photoInput = document.getElementById('photoInput');

if (photoInput) {
  photoInput.addEventListener('change', e => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      showBanner('Photo must be less than 5MB.');
      photoInput.value = '';
      return;
    }
    if (!file.type.startsWith('image/')) {
      showBanner('Please select a valid image file.');
      photoInput.value = '';
      return;
    }

    photoFile = file;

    if (photoDrop) {
      const url = URL.createObjectURL(file);
      photoDrop.classList.add('has-image');
      let img = photoDrop.querySelector('img');
      if (!img) { img = document.createElement('img'); photoDrop.appendChild(img); }
      img.src = url;
    }
  });
}

/* ── FORM SUBMIT ── */
document.getElementById('signupForm')?.addEventListener('submit', async function (e) {
  e.preventDefault();

  const name       = document.getElementById('name')?.value.trim();
  const email      = document.getElementById('email')?.value.trim();
  const password   = document.getElementById('password')?.value;
  const phone      = document.getElementById('phone')?.value.trim();
  const secretCode = document.getElementById('secretCode')?.value.trim();
  const linkedin   = document.getElementById('linkedin')?.value.trim() || '';
  const github     = document.getElementById('github')?.value.trim() || '';

  /* ── Basic validation ── */
  if (!name || !email || !password) { showBanner('Please fill in all fields.'); return; }
  if (!selectedRole)                 { showBanner('Please select your role.');   return; }
  if (password.length < 6)           { showBanner('Password must be at least 6 characters.'); return; }

  /* ── Secret code required for team / admin ── */
  if (selectedRole === 'team' || selectedRole === 'admin') {
    if (!secretCode) {
      showBanner('Please enter the secret access code for this role.');
      document.getElementById('secretCode')?.focus();
      return;
    }
  }

  /* ── Role-specific validation ── */
  if (selectedRole === 'team' || selectedRole === 'admin') {
    if (!phone) { showBanner('Please enter your phone number.'); return; }
  }
  if (selectedRole === 'team') {
    if (!selectedTeam)     { showBanner('Please select your team.'); return; }
    if (!selectedTeamRole) { showBanner('Please select your role within the team.'); return; }
  }

  setLoading(true);

  try {
    const formData = new FormData();
    formData.append('name',       name);
    formData.append('email',      email);
    formData.append('password',   password);
    formData.append('role',       selectedRole);

    /* Send secretCode — backend will validate it */
    if (selectedRole === 'team' || selectedRole === 'admin') {
      formData.append('secretCode', secretCode);
      formData.append('phone',      phone);
    }

    if (selectedRole === 'team') {
      formData.append('team',     selectedTeam);
      formData.append('teamRole', selectedTeamRole);
    }

    if (photoFile)  formData.append('photo',    photoFile);
    if (linkedin)   formData.append('linkedin', linkedin);
    if (github)     formData.append('github',   github);

    const res  = await fetch('http://localhost:5000/api/auth/signup', {
      method: 'POST',
      body:   formData,
      // Do NOT set Content-Type — browser adds the multipart boundary automatically
    });

    const data = await res.json();

    if (res.ok) {
      setLoading(false);
      document.getElementById('successOverlay')?.classList.add('show');
      setTimeout(() => { window.location.href = 'login.html'; }, 1500);
    } else {
      throw new Error(data.message || 'Registration failed. Please try again.');
    }

  } catch (err) {
    console.error(err);
    showBanner(err.message || 'Server error. Make sure the backend is running on port 5000.');
  } finally {
    setLoading(false);
  }
});