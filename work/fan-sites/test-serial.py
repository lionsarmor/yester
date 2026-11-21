from pathlib import Path
root=Path.cwd()
s=Path('work/retro-test-lab/8bit/smoke-serial.py').read_text()
s=s.replace('HERE = Path(__file__).resolve().parent','HERE = Path("work/retro-test-lab/8bit").resolve()')
s=s.replace('evidence = out / "evidence"','evidence = base / "outputs/fan-sites/evidence/live"\nevidence.mkdir(exist_ok=True)')
s=s.replace('out / "c64-gateway.py"','base / "outputs/fan-sites/live-c64.py"')
s=s.replace('range(80)','range(250)').replace('assert waitfor(1)["title"] == "LATE NIGHT SIGNAL"','assert waitfor(1)["title"] == "Moon Relay Tape Shrine"')
a=s.index('                    ("1", "STATION LOG"');b=s.index('                ],',a)
s=s[:a]+'''                    ("1","The tape index","moon-relay-tape"),
                    ("h","Moon Relay Tape Shrine","moon-relay-home"),
                    ("2","The missing caller","moon-relay-caller"),
                    ("s","Player Two Repair Club","player-two-home"),
                    ("1","Link cable log","player-two-log"),
                    ("h","Player Two Repair Club","player-two-return"),
                    ("2","Friday score slips","player-two-scores"),
'''+s[b:]
s=s.replace('assert waitfor(n)["title"] == title','result=waitfor(n)\n                assert result["title"] == title and result["http"]==200,(n,result)')
exec(s)
