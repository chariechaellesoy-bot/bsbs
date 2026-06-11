(function() {
  function $(id) { return document.getElementById(id); }

  function setAppVisibility(showApp) {
    var login = $('bds-login-screen');
    var app = $('bds-app-wrapper');
    if (!login || !app) return;
    if (showApp) {
      login.classList.add('hidden');
      app.classList.remove('hidden');
    } else {
      login.classList.remove('hidden');
      app.classList.add('hidden');
    }
  }

  function setThemeClass() {
    var login = $('bds-login-screen');
    if (!login) return;
    var theme = localStorage.getItem('theme') || 'light';
    login.classList.toggle('dark-mode', theme === 'dark');
  }

  function notify(message, type) {
    var box = $('login-notification');
    if (!box) return;
    box.textContent = message;
    box.className = 'login-notification ' + (type || 'error');
  }

  function clearNotification() {
    var box = $('login-notification');
    if (!box) return;
    box.textContent = '';
    box.className = 'login-notification hidden';
  }

  window.BSBS_AUTH = {
    apiUrl: '/api',
    clearAuth: function() {
      localStorage.removeItem('bsbs_token');
      localStorage.removeItem('bsbs_role');
      localStorage.removeItem('bsbs_display_name');
      localStorage.removeItem('bsbs_offline');
      localStorage.removeItem('bsbs_session_id');
    },
    getToken: function() {
      return localStorage.getItem('bsbs_token');
    },
    isLoggedIn: function() {
      return !!localStorage.getItem('bsbs_token');
    },
    isAdmin: function() {
      return localStorage.getItem('bsbs_role') === 'admin';
    },
    getRole: function() {
      return localStorage.getItem('bsbs_role');
    },
    getDisplayName: function() {
      return localStorage.getItem('bsbs_display_name');
    },
    handleUnauthorized: function() {
      this.clearAuth();
      setAppVisibility(false);
    },
    logout: function() {
      this.clearAuth();
      window.location.reload();
    },
    restoreSession: async function() {
      var currentToken = this.getToken();
      if (!currentToken) {
        this.handleUnauthorized();
        return false;
      }

      try {
        var res = await fetch('/api/auth/me', {
          method: 'GET',
          headers: { Authorization: 'Bearer ' + currentToken }
        });
        var data = await res.json();
        if (!res.ok || !data || !data.id) {
          this.handleUnauthorized();
          return false;
        }

        localStorage.setItem('bsbs_role', data.role || 'member');
        localStorage.setItem('bsbs_display_name', data.display_name || '');
        localStorage.removeItem('bsbs_offline');
        return true;
      } catch (err) {
        this.handleUnauthorized();
        return false;
      }
    }
  };

  document.addEventListener('DOMContentLoaded', async function() {
    setThemeClass();
    setAppVisibility(false);
    localStorage.removeItem('bsbs_offline');

    if (window.BSBS_AUTH.getToken()) {
      await window.BSBS_AUTH.restoreSession();
      setAppVisibility(window.BSBS_AUTH.isLoggedIn());
    }

    var showRegisterBtn = $('showRegisterBtn');
    var showLoginBtn = $('showLoginBtn');
    var loginPanel = $('login-form-panel');
    var registerPanel = $('register-form-panel');

    if (showRegisterBtn && loginPanel && registerPanel) {
      showRegisterBtn.addEventListener('click', function() {
        clearNotification();
        loginPanel.classList.add('hidden');
        registerPanel.classList.remove('hidden');
      });
    }

    if (showLoginBtn && loginPanel && registerPanel) {
      showLoginBtn.addEventListener('click', function() {
        clearNotification();
        registerPanel.classList.add('hidden');
        loginPanel.classList.remove('hidden');
      });
    }

    var loginBtn = $('loginBtn');
    if (loginBtn) {
      loginBtn.addEventListener('click', async function() {
        clearNotification();
        var email = ($('loginEmail') && $('loginEmail').value || '').trim();
        var password = ($('loginPassword') && $('loginPassword').value || '').trim();

        if (!email || !password) {
          notify('Please enter email and password.', 'error');
          return;
        }

        try {
          var res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password })
          });
          var data = await res.json();
          if (!res.ok || !data.token) {
            notify((data && data.error) || 'Login failed.', 'error');
            return;
          }

          localStorage.removeItem('bsbs_offline');
          localStorage.setItem('bsbs_token', data.token);
          localStorage.setItem('bsbs_role', data.role || 'member');
          localStorage.setItem('bsbs_display_name', data.display_name || '');
          clearNotification();
          setAppVisibility(true);
        } catch (err) {
          notify('Unable to connect to server.', 'error');
        }
      });
    }

    var registerBtn = $('registerBtn');
    if (registerBtn) {
      registerBtn.addEventListener('click', async function() {
        clearNotification();
        var display_name = ($('registerName') && $('registerName').value || '').trim();
        var email = ($('registerEmail') && $('registerEmail').value || '').trim();
        var password = ($('registerPassword') && $('registerPassword').value || '').trim();

        if (!display_name || !email || !password) {
          notify('Please complete all register fields.', 'error');
          return;
        }

        try {
          var res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ display_name: display_name, email: email, password: password })
          });
          var data = await res.json();
          if (!res.ok) {
            notify((data && data.error) || 'Registration failed.', 'error');
            return;
          }

          if (!data.token) {
            notify('Account created. Please sign in.', 'success');
            if (registerPanel && loginPanel) {
              registerPanel.classList.add('hidden');
              loginPanel.classList.remove('hidden');
            }
            return;
          }

          localStorage.removeItem('bsbs_offline');
          localStorage.setItem('bsbs_token', data.token);
          localStorage.setItem('bsbs_role', data.role || 'member');
          localStorage.setItem('bsbs_display_name', data.display_name || display_name);
          clearNotification();
          setAppVisibility(true);
        } catch (err) {
          notify('Unable to connect to server.', 'error');
        }
      });
    }
  });
})();
