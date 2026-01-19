import { useState, useEffect, useMemo, useRef } from 'react'
import './App.css'

const PASSWORD = 'happycamel123'
const TEAMS = [
  { id: 1, name: 'Hot Mocha Machas', logo: '/logos/hot-mocha-machas.jpeg', color: '#8B4513' },
  { id: 2, name: 'Dhaba Dominators', logo: '/logos/dhaba-dominators.jpeg', color: '#8B0000' },
  { id: 3, name: 'Blue Tokai Ballerz', logo: '/logos/blue-tokai-ballerz.jpeg', color: '#1E3A5F' },
  { id: 4, name: 'Chak De Champions', logo: '/logos/chak-de-champions.jpeg', color: '#D2691E' },
  { id: 5, name: 'GTown FC', logo: '/logos/gtown-fc.jpeg', color: '#228B22' },
  { id: 6, name: 'Food Village Phantoms', logo: '/logos/food-village-phantoms.jpeg', color: '#2F2F2F' },
]
const TOTAL_PICKS = 18
const MAX_PER_CLUB = 3

function App() {
  const [authed, setAuthed] = useState(false)
  const [pw, setPw] = useState('')
  const [players, setPlayers] = useState([])
  const [phase, setPhase] = useState('setup')
  const [draftOrder, setDraftOrder] = useState([])
  const [currentPick, setCurrentPick] = useState(0)
  const [teamRosters, setTeamRosters] = useState({})
  const [search, setSearch] = useState('')
  const [timer, setTimer] = useState(60)
  const [timerRunning, setTimerRunning] = useState(false)
  const [spinning, setSpinning] = useState(false)
  const [wheelAngle, setWheelAngle] = useState(0)
  const [wheelResult, setWheelResult] = useState([])
  const [remainingTeams, setRemainingTeams] = useState(TEAMS)
  const [justSelected, setJustSelected] = useState(null)
  const [selectedTeam, setSelectedTeam] = useState(null)
  const [showAddPlayer, setShowAddPlayer] = useState(false)
  const [customPlayer, setCustomPlayer] = useState({ name: '', position: '', rating: '', clubName: '' })
  const canvasRef = useRef(null)
  const imagesRef = useRef({})

  useEffect(() => {
    let loadedCount = 0
    TEAMS.forEach(team => {
      const img = new Image()
      img.src = team.logo
      img.onload = () => {
        imagesRef.current[team.id] = img
        loadedCount++
        if (loadedCount === TEAMS.length) {
          drawWheel(TEAMS, 0)
        }
      }
    })
  }, [])

  useEffect(() => {
    fetch('/players.json').then(r => r.json()).then(d => setPlayers(d.players || [])).catch(() => {})
    const saved = localStorage.getItem('draftState')
    if (saved) {
      const s = JSON.parse(saved)
      setPhase(s.phase || 'setup')
      setDraftOrder(s.draftOrder || [])
      setCurrentPick(s.currentPick || 0)
      setTeamRosters(s.teamRosters || {})
      setWheelResult(s.wheelResult || [])
      if (s.wheelResult && s.wheelResult.length > 0) {
        const selectedIds = new Set(s.wheelResult.map(t => t.id))
        setRemainingTeams(TEAMS.filter(t => !selectedIds.has(t.id)))
      }
    }
  }, [])

  useEffect(() => {
    if (phase !== 'setup') localStorage.setItem('draftState', JSON.stringify({ phase, draftOrder, currentPick, teamRosters, wheelResult }))
  }, [phase, draftOrder, currentPick, teamRosters, wheelResult])

  useEffect(() => {
    if (!timerRunning || timer <= 0) return
    const t = setTimeout(() => setTimer(s => s - 1), 1000)
    return () => clearTimeout(t)
  }, [timerRunning, timer])

  const drawWheel = (teams, angle, flashTeamId = null) => {
    const canvas = canvasRef.current
    if (!canvas || !teams || teams.length === 0) return
    const ctx = canvas.getContext('2d')
    const size = 500, center = size / 2, radius = 230
    const segmentAngle = 360 / teams.length

    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, size, size)
    ctx.save()
    ctx.translate(center, center)
    ctx.rotate((angle * Math.PI) / 180)

    teams.forEach((team, i) => {
      const startAngle = (i * segmentAngle - 90) * Math.PI / 180
      const endAngle = ((i + 1) * segmentAngle - 90) * Math.PI / 180
      const midAngle = (startAngle + endAngle) / 2

      ctx.beginPath()
      ctx.moveTo(0, 0)
      ctx.arc(0, 0, radius, startAngle, endAngle)

      if (flashTeamId === team.id) {
        ctx.fillStyle = '#FFD700'
      } else {
        ctx.fillStyle = team.color
      }
      ctx.fill()
      ctx.strokeStyle = '#fff'
      ctx.lineWidth = 3
      ctx.stroke()

      const img = imagesRef.current[team.id]
      if (img) {
        const logoSize = teams.length <= 3 ? 90 : teams.length <= 4 ? 80 : 70
        const logoX = Math.cos(midAngle) * (radius * 0.55) - logoSize / 2
        const logoY = Math.sin(midAngle) * (radius * 0.55) - logoSize / 2
        ctx.save()
        ctx.beginPath()
        ctx.arc(logoX + logoSize/2, logoY + logoSize/2, logoSize/2, 0, Math.PI * 2)
        ctx.clip()
        ctx.drawImage(img, logoX, logoY, logoSize, logoSize)
        ctx.restore()
      }
    })
    ctx.restore()

    ctx.beginPath()
    ctx.moveTo(center, 38)
    ctx.lineTo(center - 18, 5)
    ctx.lineTo(center + 18, 5)
    ctx.fillStyle = '#000'
    ctx.fill()
  }

  useEffect(() => { drawWheel(remainingTeams, wheelAngle) }, [wheelAngle, remainingTeams])

  const draftedIds = useMemo(() => {
    const ids = new Set()
    Object.values(teamRosters).forEach(r => r.forEach(p => ids.add(p.id)))
    return ids
  }, [teamRosters])

  const availablePlayers = useMemo(() => players.filter(p => !draftedIds.has(p.id)), [players, draftedIds])

  const filteredPlayers = useMemo(() => {
    if (!search) return availablePlayers
    const s = search.toLowerCase()
    return availablePlayers.filter(p => p.name.toLowerCase().includes(s) || p.clubName?.toLowerCase().includes(s) || p.position?.toLowerCase().includes(s))
  }, [availablePlayers, search])

  const generateDraftOrder = (order) => {
    const picks = []
    for (let round = 0; round < TOTAL_PICKS; round++) {
      const roundOrder = round % 2 === 0 ? order : [...order].reverse()
      roundOrder.forEach(teamId => picks.push(teamId))
    }
    return picks
  }

  const currentTeamId = draftOrder[currentPick]
  const currentTeam = TEAMS.find(t => t.id === currentTeamId)

  const canDraft = (player) => {
    if (!currentTeamId) return false
    const roster = teamRosters[currentTeamId] || []
    if (player.custom) return true
    const clubCount = roster.filter(p => p.clubId === player.clubId).length
    return clubCount < MAX_PER_CLUB
  }

  const draftPlayer = (player) => {
    if (!canDraft(player)) { alert(`Already have ${MAX_PER_CLUB} from ${player.clubName}`); return }
    setTeamRosters(prev => ({ ...prev, [currentTeamId]: [...(prev[currentTeamId] || []), player] }))
    setCurrentPick(prev => prev + 1)
    setTimer(60)
    setSearch('')
    if (currentPick + 1 >= draftOrder.length) setPhase('done')
  }

  const addCustomPlayer = () => {
    if (!customPlayer.name) return
    const player = {
      id: `custom-${Date.now()}`,
      name: customPlayer.name,
      position: customPlayer.position || '?',
      rating: customPlayer.rating || '?',
      clubName: customPlayer.clubName || '?',
      custom: true,
      imageUrl: ''
    }
    draftPlayer(player)
    setCustomPlayer({ name: '', position: '', rating: '', clubName: '' })
    setShowAddPlayer(false)
  }

  const spinWheel = () => {
    if (spinning || remainingTeams.length === 0) return
    setSpinning(true)
    setJustSelected(null)

    const teams = remainingTeams
    const segmentAngle = 360 / teams.length
    const spins = 4 + Math.random() * 2
    const randomOffset = Math.random() * 360
    const finalAngle = spins * 360 + randomOffset
    const duration = 3000, start = Date.now(), startAngle = 0

    const animate = () => {
      const elapsed = Date.now() - start
      const progress = Math.min(elapsed / duration, 1)
      const eased = 1 - Math.pow(1 - progress, 4)
      const currentAngle = startAngle + finalAngle * eased
      setWheelAngle(currentAngle)
      drawWheel(teams, currentAngle)

      if (progress < 1) {
        requestAnimationFrame(animate)
      } else {
        const normalizedAngle = finalAngle % 360
        const pointerAngle = (360 - normalizedAngle + 90) % 360
        const segmentIndex = Math.floor(pointerAngle / segmentAngle) % teams.length
        const winner = teams[segmentIndex]

        let flashCount = 0
        const flash = () => {
          flashCount++
          drawWheel(teams, finalAngle, flashCount % 2 === 1 ? winner.id : null)
          if (flashCount < 6) {
            setTimeout(flash, 150)
          } else {
            setJustSelected(winner)
            setTimeout(() => {
              setWheelResult(prev => [...prev, winner])
              setRemainingTeams(prev => prev.filter(t => t.id !== winner.id))
              setWheelAngle(0)
              setJustSelected(null)
              setSpinning(false)
            }, 800)
          }
        }
        flash()
      }
    }
    setWheelAngle(0)
    requestAnimationFrame(animate)
  }

  const startDraft = () => {
    setDraftOrder(generateDraftOrder(wheelResult.map(t => t.id)))
    setPhase('draft')
    setTeamRosters({})
    setCurrentPick(0)
    setTimer(60)
  }
  const resetDraft = () => {
    if (!confirm('Reset draft?')) return
    localStorage.removeItem('draftState')
    setPhase('setup'); setDraftOrder([]); setCurrentPick(0); setTeamRosters({}); setWheelResult([]); setRemainingTeams(TEAMS); setWheelAngle(0); setJustSelected(null)
  }
  const resetWheel = () => {
    if (spinning) return
    setWheelResult([])
    setRemainingTeams(TEAMS)
    setWheelAngle(0)
    setJustSelected(null)
  }

  const copyRoster = (team) => {
    const roster = teamRosters[team.id] || []
    const text = `${team.name}\n${roster.map(p => `• ${p.name} (${p.position}, ${p.rating}) - ${p.clubName}`).join('\n')}`
    navigator.clipboard.writeText(text)
    alert('Copied!')
  }

  const copyAllRosters = () => {
    const teams = wheelResult.length > 0 ? wheelResult : TEAMS
    const text = teams.map(t => {
      const roster = teamRosters[t.id] || []
      return `${t.name}\n${roster.map(p => `• ${p.name} (${p.position}, ${p.rating}) - ${p.clubName}`).join('\n')}`
    }).join('\n\n')
    navigator.clipboard.writeText(text)
    alert('All rosters copied!')
  }

  if (!authed) {
    return (
      <div className="auth">
        <h1>EFL Draft</h1>
        <input type="password" placeholder="Password" value={pw} onChange={e => setPw(e.target.value)} onKeyDown={e => e.key === 'Enter' && pw === PASSWORD && setAuthed(true)} />
        <button onClick={() => pw === PASSWORD && setAuthed(true)}>Enter</button>
      </div>
    )
  }

  if (phase === 'setup') {
    const allSelected = wheelResult.length === 6

    return (
      <div className="setup">
        <h1>EFL Draft</h1>
        <p>{players.length} players loaded</p>

        <div className="wheel-section">
          <div className="wheel-container">
            {justSelected && (
              <div className="selected-overlay" style={{ background: justSelected.color }}>
                <img src={justSelected.logo} alt="" />
                <span>#{wheelResult.length + 1}</span>
              </div>
            )}
            {remainingTeams.length > 0 ? (
              <>
                <canvas ref={canvasRef} width={500} height={500} />
                <button onClick={spinWheel} disabled={spinning || allSelected} className="spin-btn">
                  {spinning ? 'Spinning...' : allSelected ? 'All Selected!' : `SPIN (${wheelResult.length + 1}/6)`}
                </button>
              </>
            ) : (
              <div className="wheel-done">
                <span>✓</span>
              </div>
            )}
          </div>

          <div className="draft-order">
            <h2>Draft Order</h2>
            {wheelResult.length === 0 ? (
              <p className="hint">Spin the wheel to determine order</p>
            ) : (
              <ol>
                {wheelResult.map((t, i) => (
                  <li key={t.id} style={{ color: t.color }}>
                    <img src={t.logo} alt="" />
                    {t.name}
                  </li>
                ))}
              </ol>
            )}
            {allSelected && (
              <button onClick={startDraft} className="start-btn">Start Draft</button>
            )}
            {wheelResult.length > 0 && !spinning && (
              <button onClick={resetWheel} className="reset-btn">Reset Wheel</button>
            )}
          </div>
        </div>

        <button onClick={resetDraft} className="reset-btn">Reset All</button>
      </div>
    )
  }

  if (phase === 'draft') {
    const round = Math.floor(currentPick / 6) + 1
    const pickInRound = (currentPick % 6) + 1

    return (
      <div className="draft">
        <div className="draft-header">
          <h1>Round {round} • Pick {pickInRound}</h1>
          <div className="timer-box">
            <span className={timer <= 10 ? 'red' : ''}>{timer}s</span>
            <button onClick={() => setTimerRunning(!timerRunning)}>{timerRunning ? '⏸' : '▶'}</button>
            <button onClick={() => setTimer(60)}>↺</button>
          </div>
          <button onClick={copyAllRosters} className="copy-btn">Copy All</button>
          <button onClick={resetDraft} className="reset-btn">Reset</button>
        </div>

        <div className="current-team" style={{ background: currentTeam?.color }}>
          <img src={currentTeam?.logo} alt="" />
          <h2>{currentTeam?.name}</h2>
        </div>

        <div className="draft-main">
          <div className="player-search">
            <div className="search-row">
              <input type="text" placeholder="Search player, club, position..." value={search} onChange={e => setSearch(e.target.value)} autoFocus />
              <button onClick={() => setShowAddPlayer(true)} className="add-btn">+ Add</button>
            </div>
            <div className="player-list">
              {filteredPlayers.slice(0, 200).map(p => (
                <div key={p.id} className={`player-row ${!canDraft(p) ? 'disabled' : ''}`} onClick={() => canDraft(p) && draftPlayer(p)}>
                  <img src={p.imageUrl} alt="" />
                  <div className="player-info">
                    <strong>{p.name}</strong>
                    <span>{p.position} • {p.rating} • {p.clubName}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="rosters">
            {(wheelResult.length > 0 ? wheelResult : TEAMS).map(t => {
              const roster = teamRosters[t.id] || []
              return (
                <div key={t.id} className={`roster ${t.id === currentTeamId ? 'active' : ''}`} onClick={() => setSelectedTeam(t)}>
                  <div className="roster-header">
                    <img src={t.logo} alt="" />
                    <span>{t.name}</span>
                    <span className="count">{roster.length}/{TOTAL_PICKS}</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {selectedTeam && (
          <div className="modal" onClick={() => setSelectedTeam(null)}>
            <div className="modal-content" onClick={e => e.stopPropagation()}>
              <div className="modal-header">
                <img src={selectedTeam.logo} alt="" />
                <h2>{selectedTeam.name}</h2>
                <button onClick={() => copyRoster(selectedTeam)}>Copy</button>
                <button onClick={() => setSelectedTeam(null)}>✕</button>
              </div>
              <ul>{(teamRosters[selectedTeam.id] || []).map(p => <li key={p.id}>• {p.name} ({p.position}, {p.rating}) - {p.clubName}</li>)}</ul>
            </div>
          </div>
        )}

        {showAddPlayer && (
          <div className="modal" onClick={() => setShowAddPlayer(false)}>
            <div className="modal-content add-player-modal" onClick={e => e.stopPropagation()}>
              <h2>Add Custom Player</h2>
              <input placeholder="Name *" value={customPlayer.name} onChange={e => setCustomPlayer(p => ({ ...p, name: e.target.value }))} />
              <input placeholder="Position" value={customPlayer.position} onChange={e => setCustomPlayer(p => ({ ...p, position: e.target.value }))} />
              <input placeholder="Rating" value={customPlayer.rating} onChange={e => setCustomPlayer(p => ({ ...p, rating: e.target.value }))} />
              <input placeholder="Club" value={customPlayer.clubName} onChange={e => setCustomPlayer(p => ({ ...p, clubName: e.target.value }))} />
              <div className="modal-actions">
                <button onClick={addCustomPlayer}>Add to {currentTeam?.name}</button>
                <button onClick={() => setShowAddPlayer(false)}>Cancel</button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  if (phase === 'done') {
    return (
      <div className="done">
        <h1>Draft Complete!</h1>
        <button onClick={copyAllRosters} className="copy-btn">Copy All Rosters</button>
        <div className="final-rosters">
          {(wheelResult.length > 0 ? wheelResult : TEAMS).map(t => {
            const roster = teamRosters[t.id] || []
            return (
              <div key={t.id} className="final-roster" onClick={() => copyRoster(t)}>
                <div className="final-header">
                  <img src={t.logo} alt="" />
                  <h2>{t.name}</h2>
                </div>
                <ul>{roster.map(p => <li key={p.id}>• {p.name} - {p.position} ({p.rating}) - {p.clubName}</li>)}</ul>
              </div>
            )
          })}
        </div>
        <button onClick={resetDraft} className="reset-btn">New Draft</button>
      </div>
    )
  }
}

export default App
