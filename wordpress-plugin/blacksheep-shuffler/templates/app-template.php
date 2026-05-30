<?php
/**
 * Frontend template for BlackSheep Shuffler.
 *
 * @var string $asset_url
 */
?>
<div id="bds-app-wrapper">
    <div id="notification" class="notification"></div>

    <div class="app-container">
      <header>
        <div class="bds-app-title">
          <img src="<?php echo esc_url( $asset_url . 'img/blacksheeptext.png' ); ?>" alt="Logo" class="bds-logo">
          <h1>BLACKSHEEP SHUFFLER <span class="version-tag">v6.1.0</span></h1>
        </div>
        <div class="theme-switch-wrapper">
          <label class="theme-switch" for="theme-checkbox" title="Toggle Light/Dark Mode">
            <input type="checkbox" id="theme-checkbox" />
            <div class="slider"></div>
          </label>
        </div>
      </header>

      <div id="modeSelectCard" class="bds-card">
        <h3>Select Mode</h3>
        <p>Choose how you want to run today's games.</p>
        <div class="mode-grid">
          <div class="mode-card">
            <h4>Session <span class="mode-badge">Shuffle</span></h4>
            <button id="selectSessionModeBtn" class="btn-primary" style="width:100%;">Start Session</button>
          </div>
          <div class="mode-card">
            <h4>Promotion / Stacking <span class="mode-badge">Queue</span></h4>
            <button id="selectPromotionModeBtn" class="btn-info" style="width:100%;">Start Queue</button>
          </div>
        </div>
      </div>

      <div id="setupControls" class="bds-card hidden">
  <div class="setup-back-row">
    <button type="button" id="backToModeSelectFromSession" class="setup-back-btn">Back</button>
  </div>
  <h3>Initial Setup (Session Mode)</h3>

  <div>
    <label>Player Entry Mode</label>
    <div class="entry-mode-row">
      <button type="button" id="entryModeSingleBtn" class="btn-secondary">Single</button>
      <button type="button" id="entryModeBulkBtn" class="btn-toggle">Bulk</button>
    </div>
    <p id="playerEntryHint">Single mode: add one player at a time.</p>
  </div>

 <div>
  <label for="playerNameInput">Player Name</label>
  <input type="text" id="playerNameInput" placeholder="Enter player name..." />
  <textarea id="playerNameBulkInput" class="hidden" placeholder="Enter multiple names, one per line or separated by commas"></textarea>
</div>
  <div>
    <label for="playerSkillSelect">Skill</label>
    <select id="playerSkillSelect">
      <option value="Beg">Beginner</option>
      <option value="Int" selected>Intermediate</option>
      <option value="Adv">Advanced</option>
    </select>
  </div>
        <button id="addPendingPlayerBtn" class="btn-secondary" style="width:100%;margin-bottom:.5rem;">Add Player</button>
        <div>
          <h4>Players to Start <span id="pendingPlayerCount" class="mode-badge">0</span></h4>
          <div id="pendingPlayersList" class="pending-list"></div>
        </div>
        <div>
          <label for="courtCount">Number of courts</label>
          <input type="number" id="courtCount" placeholder="Number of courts" min="1" max="10" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.4rem;">
          <button id="aboutBtn" class="btn-info">About</button>
          <button id="startBtn" class="btn-primary" disabled>Start</button>
        </div>
      </div>

      <div id="promotionSetupControls" class="bds-card hidden">
        <div class="setup-back-row">
          <button type="button" id="backToModeSelectFromPromotion" class="setup-back-btn">Back</button>
        </div>
        <h3>Initial Setup (Promotion / Relegation Mode)</h3>
        <p>Enter player names only. Players move through Winners and Losers lanes and teams reshuffle every game.</p>
        <div>
          <label>Player Entry Mode</label>
          <div class="entry-mode-row">
            <button type="button" id="pEntryModeSingleBtn" class="btn-secondary">Single</button>
            <button type="button" id="pEntryModeBulkBtn" class="btn-toggle">Bulk</button>
          </div>
          <p id="pPlayerEntryHint">Single mode: add one player at a time.</p>
        </div>
        <div>
          <label for="pPlayerNameInput">Player Name</label>
          <input type="text" id="pPlayerNameInput" placeholder="Enter player name..." />
<textarea id="pPlayerNameBulkInput" class="hidden" placeholder="Enter multiple names, one per line or separated by commas"></textarea>
        </div>
        <button id="pAddPlayerBtn" class="btn-secondary" style="width:100%;margin-bottom:.5rem;">Add Player</button>
        <div>
          <h4>Players to Start <span id="promotionPendingPlayerCount" class="mode-badge">0</span></h4>
          <div id="pPlayersList" class="pending-list"></div>
        </div>
        <div>
          <label for="pCourtCount">Number of courts</label>
          <input type="number" id="pCourtCount" placeholder="Number of courts" min="1" max="10" />
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-top:.4rem;">
          <button id="pAboutBtn" class="btn-info">About</button>
          <button id="pStartBtn" class="btn-primary" disabled>Start Queue</button>
        </div>
        <p style="margin-top:.4rem;">Note: Minimum is <strong>4 players</strong>. Winners move to Winners Lane, losers move to Losers Lane, and the next lane game reshuffles teams.</p>
      </div>

      <div id="results"></div>
    </div>

    <div class="bottom-nav hidden" id="actionBar">
      <button id="statsBtn" class="nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20v-6M6 20v-10M18 20V4"/></svg>
        <span>Stats</span>
      </button>
      <button id="historyBtn" class="nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 7.54 5.04M3.51 15a9 9 0 0 0 12.95 4.97"/></svg>
        <span>History</span>
      </button>
      <button id="manageGameBtn" class="nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12.22 2h-4.44a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8.88z"/><path d="M18 2v6h6M12 18v-6M9 15h6"/></svg>
        <span>Manage</span>
      </button>
      <button id="helpBtn" class="nav-btn">
        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><path d="M12 17h.01"/></svg>
        <span>Help</span>
      </button>
    </div>

    <div class="modal-overlay" id="managementModal">
      <div class="modal-container">
        <div class="modal-header"><h3>Management (Session)</h3></div>
        <div class="modal-body">
          <div id="mgmtMenuGrid" class="mgmt-menu">
            <button class="mgmt-menu-btn" data-mgmt="addPlayer"><span class="mgmt-icon">➕</span>Add Player</button>
            <button class="mgmt-menu-btn" data-mgmt="changeSkill"><span class="mgmt-icon">🎯</span>Change Skill</button>
            <button class="mgmt-menu-btn" data-mgmt="renamePlayer"><span class="mgmt-icon">✏️</span>Rename Player</button>
            <button class="mgmt-menu-btn" data-mgmt="removePlayer"><span class="mgmt-icon">🚫</span>Remove Player</button>
            <button class="mgmt-menu-btn" data-mgmt="reinstatePlayer"><span class="mgmt-icon">♻️</span>Reinstate Player</button>
            <button class="mgmt-menu-btn" data-mgmt="courts"><span class="mgmt-icon">🏟️</span>Courts</button>
            <button class="mgmt-menu-btn" data-mgmt="customGame"><span class="mgmt-icon">📋</span>Custom Game</button>
            <button class="mgmt-menu-btn" data-mgmt="gameActions"><span class="mgmt-icon">⚙️</span>Game Actions</button>
          </div>

          <div id="mgmt-addPlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Add New Player</h4>
            <input id="mgmtNewPlayerName" type="text" placeholder="Enter player name..." />
            <select id="mgmtNewPlayerSkill">
              <option value="Beg">Beginner</option>
              <option value="Int" selected>Intermediate</option>
              <option value="Adv">Advanced</option>
            </select>
            <button id="addPlayerBtn" class="btn-primary">Add Player</button>
          </div>

          <div id="mgmt-changeSkill" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Change Skill</h4>
            <select id="skillChangePlayerSelect"><option value="">Select Player</option></select>
            <select id="skillChangeSkillSelect">
              <option value="Beg">Beginner</option>
              <option value="Int" selected>Intermediate</option>
              <option value="Adv">Advanced</option>
            </select>
            <button id="changeSkillBtn" class="btn-secondary">Update Skill</button>
          </div>

          <div id="mgmt-renamePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Rename Player</h4>
            <select id="renamePlayerSelect"><option value="">Select Player</option></select>
            <input id="renamePlayerInput" type="text" placeholder="Enter new name..." />
            <button id="renamePlayerBtn" class="btn-secondary">Rename Player</button>
          </div>

          <div id="mgmt-removePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Remove Player</h4>
            <select id="playerToRemove"><option value="">Select Player</option></select>
            <button id="removePlayerBtn" class="btn-danger">Remove Selected Player</button>
          </div>

          <div id="mgmt-reinstatePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Reinstate Player</h4>
            <select id="playerToReinstate"><option value="">Select Player</option></select>
            <button id="reinstatePlayerBtn" class="btn-secondary">Reinstate Selected Player</button>
          </div>

          <div id="mgmt-courts" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Court Management</h4>

            <h5>Add Court</h5>
            <button id="addCourtBtn" class="btn-primary" style="width:100%;">Add Court</button>

            <h5 style="margin-top:.7rem;">Remove Court</h5>
            <select id="courtToRemove" style="margin-bottom:.4rem;"><option value="">Select Court to Remove</option></select>
            <button id="removeCourtBtn" class="btn-danger" style="width:100%;">Remove Selected Court</button>

            <h5 style="margin-top:.7rem;">Rename Court</h5>
            <select id="courtToRename"><option value="">Select Court to Rename</option></select>
            <input id="courtRenameInput" type="text" placeholder="Enter new court name..." />
            <button id="renameCourtBtn" class="btn-secondary" style="width:100%;">Rename Court</button>
          </div>

          <div id="mgmt-customGame" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Custom Games <span style="font-size:.7rem;color:var(--bds-text-light);font-weight:400;">(max 3)</span></h4>
            <div id="customGamesList" class="pending-list" style="margin-bottom:.5rem;"></div>
            <div id="addCustomGameSection">
              <h5>Schedule New Custom Game</h5>
              <select id="tempPlayer1"><option value="">Select Player 1</option></select>
              <select id="tempPlayer2"><option value="">Select Player 2</option></select>
              <select id="tempPlayer3"><option value="">Select Player 3</option></select>
              <select id="tempPlayer4"><option value="">Select Player 4</option></select>
              <input id="tempAfterGames" type="number" min="0" placeholder="Insert after X games" />
              <button id="scheduleTempBtn" class="btn-secondary">Schedule Custom Game</button>
            </div>
          </div>

          <div id="mgmt-gameActions" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back>← Back</button>
            <h4>Game Actions</h4>
            <button id="undoBtn" class="btn-secondary" style="width:100%;">Undo Last Action</button>
            <div id="undoCounter" class="undo-counter"></div>
            <button id="resetGameBtn" class="btn-danger" style="margin-top:.6rem;width:100%;">Reset Everything</button>
            <button id="adminModeBtn" class="btn-warning" style="margin-top:.6rem;width:100%;">🔐 Admin Mode</button>
          </div>

          <div id="mgmt-adminMode" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-mgmt-back-to="gameActions">← Back to Game Actions</button>
            <h4>Admin Mode</h4>
            <h5>RVB Restriction</h5>
            <div class="admin-row">
              <span>Block RVB players from being paired with beginners</span>
              <label class="theme-switch" for="rvbToggle" title="Toggle RVB Restriction">
                <input type="checkbox" id="rvbToggle" />
                <div class="slider"></div>
              </label>
            </div>
            <h5 style="margin-top:.7rem;">RVB Player List</h5>
            <div id="rvbPlayerList" class="pending-list" style="max-height:160px;overflow-y:auto;margin-bottom:.4rem;"></div>
            <div style="display:flex;gap:.4rem;align-items:center;">
              <input id="rvbAddInput" type="text" placeholder="Add player to RVB list..." style="margin-bottom:0;flex:1;" />
              <button id="rvbAddBtn" class="btn-primary" style="white-space:nowrap;flex-shrink:0;">Add</button>
            </div>
          </div>

          <div id="editTeamsPanel" class="mgmt-sub-panel">
            <h4 id="editCourtTitle"></h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
              <div>
                <h5>Team A</h5>
                <select id="editPlayerA1"></select>
                <select id="editPlayerA2"></select>
              </div>
              <div>
                <h5>Team B</h5>
                <select id="editPlayerB1"></select>
                <select id="editPlayerB2"></select>
              </div>
            </div>
            <button id="saveTeamsBtn" class="btn-primary">Save Teams</button>
          </div>

          <div id="swapPlayerPanel" class="mgmt-sub-panel">
            <h4 id="swapCourtTitle"></h4>
            <label for="playerToSwapOut">Player to remove:</label>
            <select id="playerToSwapOut"></select>
            <label for="playerToSwapIn">Player to add:</label>
            <select id="playerToSwapIn"></select>
            <button id="confirmSwapBtn" class="btn-primary">Confirm Swap</button>
          </div>
        </div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="promotionManageModal">
      <div class="modal-container">
        <div class="modal-header"><h3>Management (Promotion / Relegation)</h3></div>
        <div class="modal-body">
          <div id="pmgmtMenuGrid" class="mgmt-menu">
            <button class="mgmt-menu-btn" data-pmgmt="addPlayer"><span class="mgmt-icon">➕</span>Add Player</button>
            <button class="mgmt-menu-btn" data-pmgmt="renamePlayer"><span class="mgmt-icon">✏️</span>Rename Player</button>
            <button class="mgmt-menu-btn" data-pmgmt="removePlayer"><span class="mgmt-icon">🚫</span>Remove Player</button>
            <button class="mgmt-menu-btn" data-pmgmt="reinstatePlayer"><span class="mgmt-icon">♻️</span>Reinstate Player</button>
            <button class="mgmt-menu-btn" data-pmgmt="courts"><span class="mgmt-icon">🏟️</span>Courts</button>
            <button class="mgmt-menu-btn" data-pmgmt="customGame"><span class="mgmt-icon">📋</span>Custom Game</button>
            <button class="mgmt-menu-btn" data-pmgmt="gameActions"><span class="mgmt-icon">⚙️</span>Game Actions</button>
          </div>

          <div id="pmgmt-addPlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Add New Player</h4>
            <input id="pMgmtNewPlayerName" type="text" placeholder="Enter player name..." />
            <button id="pMgmtAddPlayerBtn" class="btn-primary">Add Player</button>
          </div>

          <div id="pmgmt-renamePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Rename Player</h4>
            <select id="pRenamePlayerSelect"><option value="">Select Player</option></select>
            <input id="pRenamePlayerInput" type="text" placeholder="Enter new name..." />
            <button id="pRenamePlayerBtn" class="btn-secondary">Rename Player</button>
          </div>

          <div id="pmgmt-removePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Remove Player</h4>
            <select id="pPlayerToRemove"><option value="">Select Player</option></select>
            <button id="pRemovePlayerBtn" class="btn-danger">Remove Selected Player</button>
          </div>

          <div id="pmgmt-reinstatePlayer" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Reinstate Player</h4>
            <select id="pPlayerToReinstate"><option value="">Select Player</option></select>
            <button id="pReinstatePlayerBtn" class="btn-secondary">Reinstate Selected Player</button>
          </div>

          <div id="pmgmt-courts" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Court Management</h4>

            <h5>Add Court</h5>
            <button id="pAddCourtBtn" class="btn-primary" style="width:100%;">Add Court</button>

            <h5 style="margin-top:.7rem;">Remove Court</h5>
            <select id="pCourtToRemove" style="margin-bottom:.4rem;"><option value="">Select Court to Remove</option></select>
            <button id="pRemoveCourtBtn" class="btn-danger" style="width:100%;">Remove Selected Court</button>

            <h5 style="margin-top:.7rem;">Rename Court</h5>
            <select id="pCourtToRename"><option value="">Select Court to Rename</option></select>
            <input id="pCourtRenameInput" type="text" placeholder="Enter new court name..." />
            <button id="pRenameCourtBtn" class="btn-secondary" style="width:100%;">Rename Court</button>
          </div>

          <div id="pmgmt-customGame" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Custom Games <span style="font-size:.7rem;color:var(--bds-text-light);font-weight:400;">(max 3)</span></h4>
            <div id="pCustomGamesList" class="pending-list" style="margin-bottom:.5rem;"></div>
            <div id="pAddCustomGameSection">
              <h5>Schedule New Custom Game</h5>
              <select id="pTempPlayer1"><option value="">Select Player 1</option></select>
              <select id="pTempPlayer2"><option value="">Select Player 2</option></select>
              <select id="pTempPlayer3"><option value="">Select Player 3</option></select>
              <select id="pTempPlayer4"><option value="">Select Player 4</option></select>
              <input id="pTempAfterGames" type="number" min="0" placeholder="Insert after X games" />
              <button id="pScheduleTempBtn" class="btn-secondary">Schedule Custom Game</button>
            </div>
          </div>

          <div id="pmgmt-gameActions" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-pmgmt-back>← Back</button>
            <h4>Game Actions</h4>
            <button id="pUndoBtn" class="btn-secondary" style="width:100%;">Undo Last Action</button>
            <div id="pUndoCounter" class="undo-counter"></div>
            <button id="pResetBtn" class="btn-danger" style="margin-top:.6rem;width:100%;">Reset Promotion</button>
          </div>

          <div id="pEditTeamsPanel" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-paction="cancel-submodal">← Back</button>
            <h4 id="pEditCourtTitle"></h4>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;margin-bottom:.5rem;">
              <div>
                <h5>Team A</h5>
                <select id="pEditPlayerA1"></select>
                <select id="pEditPlayerA2"></select>
              </div>
              <div>
                <h5>Team B</h5>
                <select id="pEditPlayerB1"></select>
                <select id="pEditPlayerB2"></select>
              </div>
            </div>
            <button id="pSaveTeamsBtn" class="btn-primary">Save Teams</button>
          </div>

          <div id="pSwapPlayerPanel" class="mgmt-sub-panel">
            <button class="mgmt-back-btn" data-paction="cancel-submodal">← Back</button>
            <h4 id="pSwapCourtTitle"></h4>
            <label for="pPlayerToSwapOut">Player to remove:</label>
            <select id="pPlayerToSwapOut"></select>
            <label for="pPlayerToSwapIn">Player to add:</label>
            <select id="pPlayerToSwapIn"></select>
            <button id="pConfirmSwapBtn" class="btn-primary">Confirm Swap</button>
          </div>
        </div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="helpModal">
      <div class="modal-container">
        <div class="modal-header"><h3>Help & How-To</h3></div>
        <div class="modal-body" id="helpModalBody"></div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="statsModal">
      <div class="modal-container">
        <div class="modal-header"><h3>Statistics</h3><small id="stats-date"></small></div>
        <div class="modal-body">
          <div id="player-stats-content" class="tab-content active"></div>
        </div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="historyModal">
      <div class="modal-container">
        <div class="modal-header"><h3>Match History</h3></div>
        <div class="modal-body" id="historyModalBody"></div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>

    <div class="modal-overlay" id="aboutModal">
      <div class="modal-container">
        <div class="modal-header"><h3>About & How-To</h3></div>
        <div class="modal-body" id="aboutModalBody"></div>
        <div class="modal-footer"><button class="close-modal-btn">Close</button></div>
      </div>
    </div>
  </div>
