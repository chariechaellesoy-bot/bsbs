(function() {
  var currentSessionId = localStorage.getItem('bsbs_session_id');

  function token() {
    if (!window.BSBS_AUTH || !window.BSBS_AUTH.getToken) return null;
    return window.BSBS_AUTH.getToken();
  }

  async function request(path, options) {
    var t = token();
    if (!t) throw new Error('Missing token');

    var headers = Object.assign({}, (options && options.headers) || {}, {
      Authorization: 'Bearer ' + t
    });

    if (options && options.body && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    var response = await fetch('/api' + path, Object.assign({}, options || {}, { headers: headers }));
    if (!response.ok) {
      throw new Error('Request failed');
    }
    return response.json();
  }

  window.BSBS_API = {
    save: async function(mode, state) {
      try {
        if (!window.BSBS_AUTH || !window.BSBS_AUTH.isLoggedIn() || !window.BSBS_AUTH.isAdmin()) {
          return false;
        }

        if (!currentSessionId) {
          var created = await request('/sessions', {
            method: 'POST',
            body: JSON.stringify({ mode: mode, state_json: state })
          });
          if (created && created.id) {
            currentSessionId = created.id;
            localStorage.setItem('bsbs_session_id', String(currentSessionId));
            return true;
          }
          return false;
        }

        await request('/sessions/' + encodeURIComponent(currentSessionId), {
          method: 'PATCH',
          body: JSON.stringify({ state_json: state, match_history: state.matchHistory || [] })
        });
        return true;
      } catch (_) {
        return false;
      }
    },

    load: async function() {
      try {
        var session = await request('/sessions/active', { method: 'GET' });
        if (session && session.id) {
          currentSessionId = session.id;
          localStorage.setItem('bsbs_session_id', String(currentSessionId));
          return session;
        }
        return null;
      } catch (_) {
        return null;
      }
    },

    getPlayers: async function() {
      try {
        return await request('/players', { method: 'GET' });
      } catch (_) {
        return null;
      }
    },

    getSessions: async function() {
      try {
        return await request('/sessions', { method: 'GET' });
      } catch (_) {
        return null;
      }
    },

    clearSession: function() {
      currentSessionId = null;
      localStorage.removeItem('bsbs_session_id');
    }
  };
})();
