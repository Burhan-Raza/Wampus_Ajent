import React, { useState, useEffect } from 'react';
import { Zap, AlertTriangle, Trophy, RotateCcw, Play, Pause } from 'lucide-react';

type Literal = string;
type Clause = Literal[];

type Cell = {
  row: number;
  col: number;
  pit: boolean;
  wumpus: boolean;
  visited: boolean;
  safe: boolean;
};

type GameStatus = 'playing' | 'won' | 'lost' | 'idle';

// ---------- RESOLUTION ----------
const negate = (l: Literal): Literal =>
  l.startsWith('~') ? l.slice(1) : `~${l}`;

function resolve(ci: Clause, cj: Clause): Clause[] {
  const resolvents: Clause[] = [];

  ci.forEach(li => {
    cj.forEach(lj => {
      if (li === negate(lj)) {
        const newClause = [
          ...ci.filter(x => x !== li),
          ...cj.filter(x => x !== lj)
        ];
        resolvents.push([...new Set(newClause)]);
      }
    });
  });

  return resolvents;
}

function resolution(KB: Clause[], query: Clause): boolean {
  let clauses = [...KB, query.map(negate)];

  while (true) {
    const newClauses: Clause[] = [];

    for (let i = 0; i < clauses.length; i++) {
      for (let j = i + 1; j < clauses.length; j++) {
        const resolvents = resolve(clauses[i], clauses[j]);

        for (const r of resolvents) {
          if (r.length === 0) return true;
          newClauses.push(r);
        }
      }
    }

    const noNew = newClauses.every(nc =>
      clauses.some(c => JSON.stringify(c) === JSON.stringify(nc))
    );

    if (noNew) return false;

    clauses = [...clauses, ...newClauses];
  }
}

// ---------- GRID ----------
const dirs = [[1,0],[-1,0],[0,1],[0,-1]];

function createGrid(rows:number, cols:number):Cell[][] {
  return Array.from({length:rows}, (_,r)=>
    Array.from({length:cols}, (_,c)=>({
      row:r, col:c, pit:false, wumpus:false,
      visited:false, safe:false
    }))
  );
}

function randomize(grid:Cell[][], rows:number, cols:number){
  const g = JSON.parse(JSON.stringify(grid));

  for(let i=0;i<Math.floor(rows*cols/6);i++){
    let r=Math.floor(Math.random()*rows);
    let c=Math.floor(Math.random()*cols);
    if((r===0&&c===0)||g[r][c].pit) continue;
    g[r][c].pit=true;
  }

  let wr, wc;
  do{
    wr=Math.floor(Math.random()*rows);
    wc=Math.floor(Math.random()*cols);
  }while((wr===0&&wc===0)||g[wr][wc].pit);

  g[wr][wc].wumpus=true;
  return g;
}

function percepts(grid:Cell[][], r:number,c:number){
  let p:string[]=[];
  dirs.forEach(([dr,dc])=>{
    const nr=r+dr,nc=c+dc;
    if(grid[nr]?.[nc]?.pit) p.push('Breeze');
    if(grid[nr]?.[nc]?.wumpus) p.push('Stench');
  });
  return [...new Set(p)];
}

// ---------- APP ----------
export default function App(){
  const [rows] = useState(5);
  const [cols] = useState(5);

  const [grid, setGrid] = useState<Cell[][]>([]);
  const [agent, setAgent] = useState({ row: 0, col: 0 });
  const [KB, setKB] = useState<Clause[]>([]);
  const [steps, setSteps] = useState(0);
  const [per, setPer] = useState<string[]>([]);
  const [gameStatus, setGameStatus] = useState<GameStatus>('idle');
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const [cellCount, setCellCount] = useState(0);

  useEffect(() => { reset(); }, []);

  useEffect(() => {
    if (isAutoPlay && gameStatus === 'playing') {
      const timer = setTimeout(move, 1000);
      return () => clearTimeout(timer);
    }
  }, [isAutoPlay, gameStatus, agent, grid, KB, per, steps]);

  function reset() {
    let g = createGrid(rows, cols);
    g = randomize(g, rows, cols);

    g[0][0].visited = true;
    g[0][0].safe = true;

    setGrid(g);
    setAgent({ row: 0, col: 0 });
    setKB([]);
    setPer(percepts(g, 0, 0));
    setSteps(0);
    setGameStatus('playing');
    setIsAutoPlay(false);
    setCellCount(1);
  }

  // ---------- TELL ----------
  function updateKB(r: number, c: number, p: string[], currentKB: Clause[]): Clause[] {
    const clauses: Clause[] = [...currentKB];

    dirs.forEach(([dr, dc]) => {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) return;

      if (!p.includes('Breeze')) clauses.push([`~P_${nr}_${nc}`]);
      if (!p.includes('Stench')) clauses.push([`~W_${nr}_${nc}`]);
    });

    return clauses;
  }

  // ---------- ASK ----------
  function isSafe(r: number, c: number, kb: Clause[]): boolean {
    // Check if we can prove the cell has a pit or wumpus
    // If we can prove it's dangerous, return false (not safe)
    // If we cannot prove it's dangerous, return true (assume safe)
    
    const dangerQuery: Clause = [`P_${r}_${c}`, `W_${r}_${c}`];
    const isDangerous = resolution(kb, dangerQuery);
    return !isDangerous; // Return true if NOT dangerous
  }

  function move() {
    if (gameStatus !== 'playing') return;

    let g = JSON.parse(JSON.stringify(grid));
    let newKB = updateKB(agent.row, agent.col, per, KB);

    setSteps(s => s + 1);

    // Get all safe, unvisited neighbors
    const safeNeighbors: Array<{nr: number, nc: number, dist: number}> = [];

    for (const [dr, dc] of dirs) {
      const nr = agent.row + dr, nc = agent.col + dc;
      if (!g[nr]?.[nc] || g[nr][nc].visited) continue;

      if (isSafe(nr, nc, newKB)) {
        // Prioritize cells with fewer danger signals (more exploration)
        const p = percepts(g, nr, nc);
        const dangerLevel = p.length; // Fewer percepts = safer
        safeNeighbors.push({ nr, nc, dist: dangerLevel });
      }
    }

    // If no completely safe neighbors, try any unvisited neighbor
    if (safeNeighbors.length === 0) {
      for (const [dr, dc] of dirs) {
        const nr = agent.row + dr, nc = agent.col + dc;
        if (!g[nr]?.[nc] || g[nr][nc].visited) continue;
        safeNeighbors.push({ nr, nc, dist: 999 });
      }
    }

    // If still no neighbors, game is lost
    if (safeNeighbors.length === 0) {
      setGameStatus('lost');
      setIsAutoPlay(false);
      setKB(newKB);
      return;
    }

    // Choose the safest neighbor (least danger signals)
    safeNeighbors.sort((a, b) => a.dist - b.dist);
    const { nr, nc } = safeNeighbors[0];

    g[nr][nc].visited = true;
    g[nr][nc].safe = true;

    const p = percepts(g, nr, nc);

    // Check if landed on danger
    if (g[nr][nc].wumpus || g[nr][nc].pit) {
      setAgent({ row: nr, col: nc });
      setPer(p);
      setGrid(g);
      setGameStatus('lost');
      setIsAutoPlay(false);
      setKB(newKB);
      return;
    }

    // Move successful - update state
    setAgent({ row: nr, col: nc });
    setPer(p);
    setGrid(g);
    setKB(newKB);
    
    const visitedSafe = g.flat().filter((c: Cell) => c.visited && !c.pit && !c.wumpus).length;
    setCellCount(visitedSafe);

    // Check if won (visited all safe cells)
    const totalSafe = g.flat().filter((c: Cell) => !c.pit && !c.wumpus).length;
    if (visitedSafe === totalSafe) {
      setGameStatus('won');
      setIsAutoPlay(false);
    }
  }

  const getCellStyle = (cell: Cell) => {
    let bg = '#374151'; // gray-700
    let icon = '';

    if (agent.row === cell.row && agent.col === cell.col) {
      bg = '#3b82f6'; // blue-500
      icon = '🤖';
    } else if (cell.wumpus) {
      bg = '#991b1b'; // red-900
      icon = '👹';
    } else if (cell.pit) {
      bg = '#1f2937'; // gray-900
      icon = '⚫';
    } else if (cell.visited && cell.safe) {
      bg = '#10b981'; // green-500
      icon = '✓';
    } else if (cell.visited) {
      bg = '#6b7280'; // gray-500
    }

    return { bg, icon };
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      padding: '40px 20px',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      color: '#fff'
    }}>
      <div style={{
        maxWidth: '900px',
        margin: '0 auto',
        background: 'rgba(0,0,0,0.3)',
        borderRadius: '20px',
        padding: '40px',
        backdropFilter: 'blur(10px)',
        border: '1px solid rgba(255,255,255,0.1)'
      }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '30px' }}>
          <h1 style={{
            fontSize: '36px',
            fontWeight: 'bold',
            marginBottom: '10px',
            background: 'linear-gradient(135deg, #ff6b6b, #ffd93d)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            🤖 Wumpus World AI Agent
          </h1>
          <p style={{ fontSize: '16px', opacity: 0.8 }}>Logical Reasoning meets Interactive Adventure</p>
        </div>

        {/* Game Status */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-around',
          marginBottom: '30px',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '15px 25px',
            borderRadius: '10px',
            textAlign: 'center',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '5px' }}>STATUS</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>
              {gameStatus === 'won' && '🏆 WON!'}
              {gameStatus === 'lost' && '💀 LOST!'}
              {gameStatus === 'playing' && '⚡ PLAYING'}
            </div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '15px 25px',
            borderRadius: '10px',
            textAlign: 'center',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '5px' }}>STEPS</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{steps}</div>
          </div>

          <div style={{
            background: 'rgba(255,255,255,0.1)',
            padding: '15px 25px',
            borderRadius: '10px',
            textAlign: 'center',
            flex: '1',
            minWidth: '150px'
          }}>
            <div style={{ opacity: 0.7, fontSize: '12px', marginBottom: '5px' }}>EXPLORED</div>
            <div style={{ fontSize: '18px', fontWeight: 'bold' }}>{cellCount}/{rows * cols}</div>
          </div>
        </div>

        {/* Percepts */}
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '30px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '10px' }}>CURRENT PERCEPTS</div>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {per.length > 0 ? per.map((p, i) => (
              <div key={i} style={{
                background: p === 'Breeze' ? 'rgba(59, 130, 246, 0.5)' : 'rgba(239, 68, 68, 0.5)',
                padding: '8px 16px',
                borderRadius: '20px',
                fontSize: '13px',
                fontWeight: '500',
                border: p === 'Breeze' ? '1px solid rgba(59, 130, 246, 0.8)' : '1px solid rgba(239, 68, 68, 0.8)',
                animation: 'pulse 2s infinite'
              }}>
                {p === 'Breeze' ? '💨' : '👃'} {p}
              </div>
            )) : (
              <div style={{ opacity: 0.5 }}>No percepts detected</div>
            )}
          </div>
        </div>

        {/* Goal State */}
        <div style={{
          background: gameStatus === 'won' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255,255,255,0.05)',
          padding: '20px',
          borderRadius: '10px',
          marginBottom: '30px',
          border: gameStatus === 'won' ? '2px solid rgba(16, 185, 129, 0.6)' : '1px solid rgba(255,255,255,0.1)',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '14px', opacity: 0.7, marginBottom: '8px' }}>GOAL</div>
          <div style={{ fontSize: '18px', fontWeight: 'bold', color: gameStatus === 'won' ? '#10b981' : '#fff' }}>
            Explore All Safe Cells: {cellCount}/{rows * cols - Math.floor((rows*cols)/6) - 1}
          </div>
          {gameStatus === 'won' && (
            <div style={{ marginTop: '10px', fontSize: '16px', color: '#10b981' }}>
              🎉 VICTORY! All safe cells explored!
            </div>
          )}
        </div>

        {/* Controls */}
        <div style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '30px',
          flexWrap: 'wrap',
          justifyContent: 'center'
        }}>
          <button onClick={move} disabled={gameStatus !== 'playing'} style={{
            padding: '12px 24px',
            background: gameStatus === 'playing' ? '#3b82f6' : '#9ca3af',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            transition: 'all 0.3s',
            opacity: gameStatus === 'playing' ? 1 : 0.5
          }}>
            <Play size={16} /> AUTO MOVE
          </button>

          <button onClick={() => setIsAutoPlay(!isAutoPlay)} disabled={gameStatus !== 'playing'} style={{
            padding: '12px 24px',
            background: isAutoPlay ? '#10b981' : '#6366f1',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}>
            {isAutoPlay ? <Pause size={16} /> : <Play size={16} />}
            {isAutoPlay ? 'PAUSE' : 'AUTO PLAY'}
          </button>

          <button onClick={reset} style={{
            padding: '12px 24px',
            background: '#ec4899',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '14px',
            transition: 'all 0.3s'
          }}>
            <RotateCcw size={16} /> RESET
          </button>
        </div>

        {/* Directional Controls */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '10px',
          marginBottom: '30px',
          padding: '20px',
          background: 'rgba(255,255,255,0.05)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.1)'
        }}>
          <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '10px' }}>MANUAL CONTROLS</div>
          
          {/* Up Arrow */}
          <button onClick={() => {
            if (gameStatus !== 'playing') return;
            setIsAutoPlay(false);
            let g = JSON.parse(JSON.stringify(grid));
            let newKB = updateKB(agent.row, agent.col, per, KB);
            setSteps(s => s + 1);
            
            const nr = agent.row - 1, nc = agent.col;
            if (g[nr]?.[nc] && !g[nr][nc].visited) {
              if (isSafe(nr, nc, newKB)) {
                g[nr][nc].visited = true;
                g[nr][nc].safe = true;
                const p = percepts(g, nr, nc);
                if (g[nr][nc].wumpus || g[nr][nc].pit) {
                  setAgent({ row: nr, col: nc });
                  setPer(p);
                  setGrid(g);
                  setGameStatus('lost');
                  setKB(newKB);
                  return;
                }
                setAgent({ row: nr, col: nc });
                setPer(p);
                setGrid(g);
                setKB(newKB);
                const visitedSafe = g.flat().filter((c: Cell) => c.visited && !c.pit && !c.wumpus).length;
                setCellCount(visitedSafe);
                const totalSafe = g.flat().filter((c: Cell) => !c.pit && !c.wumpus).length;
                if (visitedSafe === totalSafe) setGameStatus('won');
              }
            }
          }} disabled={gameStatus !== 'playing'} style={{
            width: '60px',
            height: '60px',
            padding: '0',
            background: gameStatus === 'playing' ? '#10b981' : '#9ca3af',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontWeight: 'bold',
            cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
            fontSize: '18px',
            transition: 'all 0.3s'
          }}>
            ⬆️
          </button>

          {/* Left, Down, Right */}
          <div style={{ display: 'flex', gap: '10px' }}>
            <button onClick={() => {
              if (gameStatus !== 'playing') return;
              setIsAutoPlay(false);
              let g = JSON.parse(JSON.stringify(grid));
              let newKB = updateKB(agent.row, agent.col, per, KB);
              setSteps(s => s + 1);
              
              const nr = agent.row, nc = agent.col - 1;
              if (g[nr]?.[nc] && !g[nr][nc].visited) {
                if (isSafe(nr, nc, newKB)) {
                  g[nr][nc].visited = true;
                  g[nr][nc].safe = true;
                  const p = percepts(g, nr, nc);
                  if (g[nr][nc].wumpus || g[nr][nc].pit) {
                    setAgent({ row: nr, col: nc });
                    setPer(p);
                    setGrid(g);
                    setGameStatus('lost');
                    setKB(newKB);
                    return;
                  }
                  setAgent({ row: nr, col: nc });
                  setPer(p);
                  setGrid(g);
                  setKB(newKB);
                  const visitedSafe = g.flat().filter((c: Cell) => c.visited && !c.pit && !c.wumpus).length;
                  setCellCount(visitedSafe);
                  const totalSafe = g.flat().filter((c: Cell) => !c.pit && !c.wumpus).length;
                  if (visitedSafe === totalSafe) setGameStatus('won');
                }
              }
            }} disabled={gameStatus !== 'playing'} style={{
              width: '60px',
              height: '60px',
              padding: '0',
              background: gameStatus === 'playing' ? '#10b981' : '#9ca3af',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
              fontSize: '18px',
              transition: 'all 0.3s'
            }}>
              ⬅️
            </button>

            <button onClick={() => {
              if (gameStatus !== 'playing') return;
              setIsAutoPlay(false);
              let g = JSON.parse(JSON.stringify(grid));
              let newKB = updateKB(agent.row, agent.col, per, KB);
              setSteps(s => s + 1);
              
              const nr = agent.row + 1, nc = agent.col;
              if (g[nr]?.[nc] && !g[nr][nc].visited) {
                if (isSafe(nr, nc, newKB)) {
                  g[nr][nc].visited = true;
                  g[nr][nc].safe = true;
                  const p = percepts(g, nr, nc);
                  if (g[nr][nc].wumpus || g[nr][nc].pit) {
                    setAgent({ row: nr, col: nc });
                    setPer(p);
                    setGrid(g);
                    setGameStatus('lost');
                    setKB(newKB);
                    return;
                  }
                  setAgent({ row: nr, col: nc });
                  setPer(p);
                  setGrid(g);
                  setKB(newKB);
                  const visitedSafe = g.flat().filter((c: Cell) => c.visited && !c.pit && !c.wumpus).length;
                  setCellCount(visitedSafe);
                  const totalSafe = g.flat().filter((c: Cell) => !c.pit && !c.wumpus).length;
                  if (visitedSafe === totalSafe) setGameStatus('won');
                }
              }
            }} disabled={gameStatus !== 'playing'} style={{
              width: '60px',
              height: '60px',
              padding: '0',
              background: gameStatus === 'playing' ? '#10b981' : '#9ca3af',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
              fontSize: '18px',
              transition: 'all 0.3s'
            }}>
              ⬇️
            </button>

            <button onClick={() => {
              if (gameStatus !== 'playing') return;
              setIsAutoPlay(false);
              let g = JSON.parse(JSON.stringify(grid));
              let newKB = updateKB(agent.row, agent.col, per, KB);
              setSteps(s => s + 1);
              
              const nr = agent.row, nc = agent.col + 1;
              if (g[nr]?.[nc] && !g[nr][nc].visited) {
                if (isSafe(nr, nc, newKB)) {
                  g[nr][nc].visited = true;
                  g[nr][nc].safe = true;
                  const p = percepts(g, nr, nc);
                  if (g[nr][nc].wumpus || g[nr][nc].pit) {
                    setAgent({ row: nr, col: nc });
                    setPer(p);
                    setGrid(g);
                    setGameStatus('lost');
                    setKB(newKB);
                    return;
                  }
                  setAgent({ row: nr, col: nc });
                  setPer(p);
                  setGrid(g);
                  setKB(newKB);
                  const visitedSafe = g.flat().filter((c: Cell) => c.visited && !c.pit && !c.wumpus).length;
                  setCellCount(visitedSafe);
                  const totalSafe = g.flat().filter((c: Cell) => !c.pit && !c.wumpus).length;
                  if (visitedSafe === totalSafe) setGameStatus('won');
                }
              }
            }} disabled={gameStatus !== 'playing'} style={{
              width: '60px',
              height: '60px',
              padding: '0',
              background: gameStatus === 'playing' ? '#10b981' : '#9ca3af',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold',
              cursor: gameStatus === 'playing' ? 'pointer' : 'not-allowed',
              fontSize: '18px',
              transition: 'all 0.3s'
            }}>
              ➡️
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${cols}, 1fr)`,
          gap: '12px',
          marginTop: '30px',
          padding: '20px',
          background: 'rgba(0,0,0,0.2)',
          borderRadius: '15px',
          justifyItems: 'center'
        }}>
          {grid.flat().map((cell, i) => {
            const { bg, icon } = getCellStyle(cell);

            return (
              <div key={i} style={{
                width: '70px',
                height: '70px',
                background: bg,
                borderRadius: '10px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '28px',
                fontWeight: 'bold',
                border: agent.row === cell.row && agent.col === cell.col ? '3px solid #fbbf24' : '1px solid rgba(255,255,255,0.2)',
                transition: 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)',
                boxShadow: agent.row === cell.row && agent.col === cell.col ? '0 0 20px rgba(251, 191, 36, 0.5)' : 'none',
                cursor: 'default',
                transform: agent.row === cell.row && agent.col === cell.col ? 'scale(1.1)' : 'scale(1)'
              }}>
                <div style={{ textShadow: '0 2px 8px rgba(0,0,0,0.5)' }}>
                  {icon}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.6; }
        }
        button:hover:not(:disabled) {
          transform: translateY(-2px);
          box-shadow: 0 10px 20px rgba(0,0,0,0.3);
        }
        button:active:not(:disabled) {
          transform: translateY(0);
        }
      `}</style>
    </div>
  );
}