import type { Lesson, SceneLink, SceneNode } from '../engine/types';

/** Place by screen column d (right is positive) and depth s (down is positive). */
const at = (d: number, s: number): [number, number] => [(s + d) / 2, (s - d) / 2];
const link = (from: string, to: string, label?: string, extra: Partial<SceneLink> = {}): SceneLink => ({ from, to, label, ...extra });

const app: SceneNode = { id: 'app', kind: 'block', at: at(-4, -2), label: 'App code', sub: 'the caller', icon: 'Code', tint: 'gray' };
const logger: SceneNode = { id: 'logger', kind: 'block', at: at(0, -2), label: 'Logger', sub: 'concrete class', icon: 'FileText', tint: 'green' };
const file: SceneNode = { id: 'file', kind: 'block', at: at(4, -2), label: 'app.log', sub: 'file on disk', icon: 'HardDrive', tint: 'gray' };
const level: SceneNode = { id: 'level', kind: 'block', at: at(-3, 5), label: 'Level', sub: 'enum', icon: 'Signal', tint: 'amber' };
const record: SceneNode = { id: 'record', kind: 'block', at: at(-2, 2), label: 'LogRecord', sub: 'data class', icon: 'Receipt', tint: 'green' };
const fmt: SceneNode = { id: 'fmt', kind: 'block', at: at(-2, 2), label: 'Formatter', sub: 'interface', icon: 'Braces', tint: 'violet' };
const plain: SceneNode = { id: 'plain', kind: 'block', at: at(2, 2), label: 'PlainFormatter', sub: 'concrete class', icon: 'FileText', tint: 'green' };
const json: SceneNode = { id: 'json', kind: 'block', at: at(6, 2), label: 'JsonFormatter', sub: 'concrete class', icon: 'FileJson', tint: 'green' };
const handler: SceneNode = { id: 'handler', kind: 'block', at: at(4, -2), label: 'Handler', sub: 'abstract class', icon: 'Share2', tint: 'blue' };
const hConsole: SceneNode = { id: 'hcon', kind: 'block', at: at(-3, 5), label: 'ConsoleHandler', sub: 'concrete class', icon: 'Code', tint: 'green' };
const hFile: SceneNode = { id: 'hfile', kind: 'block', at: at(3, 5), label: 'FileHandler', sub: 'concrete class', icon: 'HardDrive', tint: 'green' };
const hSlack: SceneNode = { id: 'hslack', kind: 'block', at: at(6, 2), label: 'SlackHandler', sub: 'concrete class', icon: 'Mail', tint: 'green' };
const slack: SceneNode = { id: 'slack', kind: 'block', at: at(6, 6), label: 'Slack API', sub: 'external, 300 ms', icon: 'Network', tint: 'gray' };
const queue: SceneNode = { id: 'queue', kind: 'block', at: at(0, 2), label: 'Queue', sub: 'bounded, 10,000', icon: 'Inbox', tint: 'amber' };
const worker: SceneNode = { id: 'worker', kind: 'worker', at: at(4, 2), label: 'Worker', sub: 'drain thread' };

export const lldLogger: Lesson = {
  id: 'lld-logger',
  title: 'Logger',
  tagline: 'Start with print and fix one pain at a time: levels, formatters, many destinations, a slow sink and a clean shutdown.',
  minutes: 16,
  level: 'Intermediate',
  learn: [
    'Log levels and a LogRecord, so a line has meaning before it has a destination',
    'The Strategy pattern for formatters and the Chain of Responsibility for destinations',
    'A producer-consumer queue that keeps a slow sink off the request thread',
    'Full queues, shutdown flushing, thread safety and handlers that fail',
    'One shared logger through a registry, file rotation and a memory handler for tests',
  ],
  metrics: [
    { key: 'classes', label: 'Classes', icon: 'Boxes' },
    { key: 'sinks', label: 'Destinations', icon: 'Share2' },
    { key: 'wait', label: 'Caller waits', icon: 'Timer' },
    { key: 'safe', label: 'Safe', icon: 'Shield' },
  ],
  steps: [
    {
      title: 'print()',
      tag: 'problem',
      heading: 'Design a logger: start with print and feel the pain',
      eli5: 'A **logger** is the class secretary. Right now the kids just shout what happened across the room. When the bell rings and everyone leaves, nothing is written down.',
      body: [
        'Every service needs to say what it is doing. The first version is `print(msg)`. It works on a laptop.',
        'In production it fails fast. Output goes to stdout only, so a crash or a restart loses it. There is no timestamp, no way to tell an error from a note, and nothing to search later.',
      ],
      keyIdea: 'print is not a logger. A logger keeps messages, labels them and sends them somewhere that survives.',
      metrics: { classes: '0', sinks: '1 (stdout)', wait: '0 ms', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [
          { ...app, status: 'active', chips: ['print("paid")'] },
          { id: 'stdout', kind: 'block', at: at(2, -2), label: 'stdout', sub: 'gone on restart', icon: 'Signal', tint: 'gray', status: 'hot' },
          { id: 'ops', kind: 'block', at: at(-1, 4), label: 'On-call', sub: 'needs the story', icon: 'User', tint: 'amber' },
        ],
        links: [link('app', 'stdout', 'print'), link('ops', 'stdout', 'reads?', { style: 'dashed', labelTone: 'warn' })],
        flows: [{ path: ['app', 'stdout'], tone: 'request', label: 'paid', duration: 1.5 }],
        panel: {
          title: 'v1 print',
          icon: 'Code',
          code: 'def log(msg):\n  print(msg)\n\nlog("payment ok")',
          footer: { text: 'Lost on crash, no time, no severity', tone: 'bad' },
        },
        caption: 'Messages vanish with the process',
      },
    },
    {
      title: 'v2 file',
      tag: 'concept',
      heading: 'v2: write to a file so messages survive',
      eli5: 'The secretary now writes every note in a **diary** on the shelf. When the kids go home, the diary stays.',
      body: [
        'A `Logger` class opens a file in append mode and writes one line per message. Calling `flush()` pushes the line to the OS, so a crash right after still leaves it on disk.',
        'The app now has a **has-a** link to a file. Messages survive restarts and can be searched with `grep`.',
      ],
      keyIdea: 'Persist first. A message that disappears with the process cannot help you debug the crash.',
      metrics: { classes: '1', sinks: '1 (file)', wait: '1 ms', safe: 'no' },
      metricTones: { safe: 'bad' },
      scene: {
        nodes: [app, { ...logger, status: 'active' }, file],
        links: [link('app', 'logger', 'uses'), link('logger', 'file', 'writes')],
        flows: [
          { path: ['app', 'logger'], tone: 'request', label: 'log("paid")', duration: 1.4 },
          { path: ['logger', 'file'], tone: 'data', label: 'append + flush', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'v2 Logger',
          icon: 'Code',
          code: 'class Logger:\n  def __init__(self, path):\n    self.f = open(path, "a")\n  def log(self, msg):\n    self.f.write(msg + "\\n")\n    self.f.flush()',
          footer: { text: 'Pain: every DEBUG line floods the disk', tone: 'warn' },
        },
        caption: 'Append a line, flush it',
      },
      code: {
        language: 'python',
        title: 'v2: a file-backed logger',
        source: `class Logger:
    def __init__(self, path):
        self.f = open(path, "a")

    def log(self, msg):
        self.f.write(msg + "\\n")
        self.f.flush()  # reach the OS now, not at exit`,
        highlight: [3, 6, 7],
      },
    },
    {
      title: 'Levels',
      tag: 'concept',
      heading: 'v3: a Level enum and a threshold',
      eli5: 'Notes now come in sizes: tiny chatter, normal news and loud alarms. The secretary only writes down notes at or above the size the teacher asked for.',
      body: [
        'Production emits millions of `DEBUG` lines nobody reads. Give every message a **level**: `DEBUG` 10, `INFO` 20, `WARN` 30, `ERROR` 40.',
        'Use an `IntEnum` so levels compare with `<`. The logger holds a `min_level` and drops anything below it with one `if`. Change the threshold, not the code.',
      ],
      keyIdea: 'Levels are ordered numbers. One comparison against a threshold decides what is kept.',
      metrics: { classes: '2', sinks: '1 (file)', wait: '1 ms', safe: 'no' },
      metricTones: { classes: 'good', safe: 'bad' },
      scene: {
        nodes: [{ ...logger, status: 'active', chips: [{ text: 'min = INFO', tone: 'good' }] }, level, file],
        links: [link('logger', 'level', 'has-a'), link('logger', 'file', 'writes')],
        flows: [
          { path: ['logger', 'level'], tone: 'request', label: 'DEBUG < INFO', duration: 1.3 },
          { path: ['logger', 'file'], tone: 'data', label: 'ERROR kept', duration: 1.5, delay: 1.4 },
        ],
        panel: {
          title: 'Level order',
          icon: 'Signal',
          rows: [
            { text: 'DEBUG', value: '10 dropped', tone: 'muted' },
            { text: 'INFO', value: '20 kept', tone: 'good' },
            { text: 'WARN', value: '30 kept', tone: 'good' },
            { text: 'ERROR', value: '40 kept', tone: 'good' },
          ],
          footer: { text: 'Pain: the format is hardcoded', tone: 'warn' },
        },
        caption: 'Drop what is below the threshold',
      },
      code: {
        language: 'python',
        title: 'v3: levels and a filter',
        source: `from enum import IntEnum

class Level(IntEnum):
    DEBUG = 10
    INFO = 20
    WARN = 30
    ERROR = 40

class Logger:
    def __init__(self, path, min_level=Level.INFO):
        self.f = open(path, "a")
        self.min = min_level

    def log(self, level, msg):
        if level < self.min:
            return
        self.f.write(f"[{level.name}] {msg}\\n")`,
        highlight: [10, 11, 14, 15, 16],
      },
    },
    {
      title: 'LogRecord',
      tag: 'concept',
      heading: 'Turn a message into a LogRecord',
      eli5: 'Each note gets a little card with the time, the size, who wrote it and the words. Cards are easy to pass around. Loose words on scrap paper are not.',
      body: [
        'A bare string cannot carry a timestamp, a level or the thread that wrote it. Wrap them in a `LogRecord` built once, at the moment of the call.',
        'The record is **immutable data**. The logger creates it, and every later class (formatter, handler) only reads it. Capturing the time here matters later: a queued message must keep the time it was written, not the time it was printed.',
      ],
      keyIdea: 'Capture facts at call time in one immutable record. Everything downstream just reads it.',
      metrics: { classes: '3', sinks: '1 (file)', wait: '1 ms', safe: 'no' },
      metricTones: { classes: 'good', safe: 'bad' },
      scene: {
        nodes: [{ ...logger, at: at(-2, -2) }, { ...record, at: at(2, -2), status: 'active' }, { ...level, at: at(-4, 5) }],
        links: [link('logger', 'record', 'creates'), link('record', 'level', 'has-a')],
        flows: [{ path: ['logger', 'record'], tone: 'request', label: 'LogRecord(...)', duration: 1.6 }],
        panel: {
          title: 'One record',
          icon: 'Receipt',
          rows: [
            { text: 'ts', value: '1731850000.123' },
            { text: 'level', value: 'ERROR' },
            { text: 'name', value: 'payments' },
            { text: 'thread', value: 'worker-3' },
            { text: 'msg', value: 'card declined' },
          ],
        },
        caption: 'Facts captured once, at call time',
      },
      code: {
        language: 'python',
        title: 'The record every later class reads',
        source: `import time, threading
from dataclasses import dataclass, field

@dataclass(frozen=True)
class LogRecord:
    level: Level
    name: str
    msg: str
    ts: float = field(default_factory=time.time)
    thread: str = field(
        default_factory=lambda: threading.current_thread().name)`,
        highlight: [4, 8, 9],
      },
    },
    {
      title: 'Formatter',
      tag: 'concept',
      heading: 'v4: pull the format out behind an interface',
      eli5: 'The class secretary always writes in plain handwriting. The principal wants neat print and the librarian wants a table. So handwriting becomes a **formatter** the secretary can swap.',
      body: [
        'Ops wants JSON for search. Another team wants a syslog style. Editing `log()` for each is the pain: a new format means a changed logger.',
        'Define a `Formatter` **interface** with one method, `format(record) -> str`. The logger holds a Formatter and calls it. This is the **Strategy** pattern: the algorithm is a swappable object.',
      ],
      keyIdea: 'Strategy: put a varying algorithm behind an interface, and the logger never changes when a new one appears.',
      metrics: { classes: '4', sinks: '1 (file)', wait: '1 ms', safe: 'no' },
      metricTones: { classes: 'good', safe: 'bad' },
      scene: {
        nodes: [{ ...logger, at: at(-4, -2), chips: [{ text: 'fmt: Formatter', tone: 'good' }] }, { ...fmt, at: at(0, -2), status: 'active' }, { ...record, at: at(4, -2) }],
        links: [link('logger', 'fmt', 'has-a'), link('fmt', 'record', 'reads')],
        flows: [
          { path: ['logger', 'fmt'], tone: 'request', label: 'format(record)', duration: 1.4 },
          { path: ['fmt', 'logger'], tone: 'response', label: 'str', duration: 1.4, delay: 1.5 },
        ],
        panel: {
          title: 'The contract',
          icon: 'Braces',
          code: 'class Formatter(ABC):\n  @abstractmethod\n  def format(self, r: LogRecord) -> str: ...',
          footer: { text: 'One method, many implementations', tone: 'good' },
        },
        caption: 'The logger asks, a Formatter answers',
      },
    },
    {
      title: 'Two formats',
      tag: 'case',
      heading: 'Plain and JSON formatters, same call',
      eli5: 'The secretary hands the same card to a plain-handwriting helper or a table-drawing helper. The card never changes. Only the helper does.',
      body: [
        '`PlainFormatter` returns a readable line. `JsonFormatter` returns one JSON object per line, which log search tools parse directly.',
        'Both **implement** `Formatter`. The logger calls `fmt.format(record)` and cannot tell which one it got. A third format is a new class, with zero edits elsewhere. That is the open-closed principle at work.',
      ],
      keyIdea: 'New output format means a new class, not a new if branch.',
      metrics: { classes: '6', sinks: '1 (file)', wait: '1 ms', safe: 'no' },
      metricTones: { classes: 'good', safe: 'bad' },
      scene: {
        nodes: [fmt, { ...plain, at: at(2, 2), status: 'active', chips: ['12:00 [ERROR] declined'] }, { ...json, at: at(6, 2), chips: ['{"lvl":"ERROR"}'] }],
        links: [link('plain', 'fmt', 'implements'), link('json', 'fmt', 'implements')],
        flows: [
          { path: ['fmt', 'plain'], tone: 'request', label: 'format(r)', duration: 1.4 },
          { path: ['fmt', 'json'], tone: 'request', label: 'format(r)', duration: 1.4, delay: 0.3 },
        ],
        panel: {
          title: 'Same record, two strings',
          icon: 'FileText',
          rows: [
            { text: 'Plain', value: '1731850000.123 [ERROR] declined' },
            { text: 'JSON', value: '{"ts":...,"lvl":"ERROR"}' },
          ],
        },
        caption: 'Two concrete classes behind one interface',
      },
      code: {
        language: 'python',
        title: 'v4: formatters',
        source: `import json
from abc import ABC, abstractmethod

class Formatter(ABC):
    @abstractmethod
    def format(self, r: LogRecord) -> str: ...

class PlainFormatter(Formatter):
    def format(self, r):
        return f"{r.ts:.3f} [{r.level.name}] {r.msg}"

class JsonFormatter(Formatter):
    def format(self, r):
        return json.dumps({"ts": r.ts, "lvl": r.level.name,
                           "name": r.name, "msg": r.msg})`,
        highlight: [4, 5, 6, 8, 13],
      },
    },
    {
      title: 'One sink',
      tag: 'concept',
      heading: 'The pain: one destination is not enough',
      eli5: 'A loud alarm note should go in the diary, on the classroom board and to the head teacher. The secretary only has one hand and one place to put it.',
      body: [
        'Production wants an `ERROR` on stderr, in the file and as a Slack alert. A `DEBUG` should go only to the file.',
        'The logger has one destination field. Making it a list helps, but each destination also wants its own threshold and its own formatter. We need a **handler** class that owns all three: where, how and how loud.',
      ],
      keyIdea: 'A destination is more than a file handle. It has its own level, its own format and its own failure mode.',
      metrics: { classes: '6', sinks: '1', wait: '1 ms', safe: 'no' },
      metricTones: { sinks: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -2) },
          { ...logger, at: at(0, -2), status: 'hot', chips: [{ text: 'dest: one only', tone: 'bad' }] },
          { ...file, at: at(4, -2) },
        ],
        links: [link('app', 'logger'), link('logger', 'file')],
        flows: [{ path: ['app', 'logger', 'file'], tone: 'request', label: 'ERROR', duration: 2 }],
        panel: {
          title: 'What ops wants',
          icon: 'Table',
          rows: [
            { text: 'Console', value: 'WARN and up, stderr' },
            { text: 'File', value: 'INFO and up, JSON' },
            { text: 'Slack', value: 'ERROR only', tone: 'warn' },
          ],
          footer: { text: 'Three destinations, three thresholds', tone: 'warn' },
        },
        caption: 'One field cannot hold three places',
      },
    },
    {
      title: 'Handler chain',
      tag: 'concept',
      heading: 'v5: Handlers linked in a chain',
      eli5: 'The note card is passed from desk to desk. Each child decides alone: write it in my notebook, ignore it, or pass it on to the next desk.',
      body: [
        '`Handler` is an abstract class with a `next` link. Its `handle(record)` runs the subclass work in `_do`, then forwards the record to `next`. This is **Chain of Responsibility**.',
        '`ConsoleHandler`, `FileHandler` and `SlackHandler` extend it. Each filters with its own level inside `_do`. The logger only knows the head of the chain.',
      ],
      keyIdea: 'Each handler owns its level and format, and the logger knows only the head of the chain.',
      metrics: { classes: '10', sinks: '3', wait: '1 ms', safe: 'no' },
      metricTones: { classes: 'good', sinks: 'good', safe: 'bad' },
      scene: {
        nodes: [{ ...logger, at: at(-4, -2) }, { ...handler, at: at(0, -2), status: 'active' }, hConsole, hFile],
        links: [link('logger', 'handler', 'has-a'), link('hcon', 'handler', 'extends'), link('hfile', 'handler', 'extends'), link('handler', 'handler', undefined, { style: 'faint' })].slice(0, 3),
        flows: [
          { path: ['logger', 'handler'], tone: 'request', label: 'handle(r)', duration: 1.2 },
          { path: ['handler', 'hcon'], tone: 'data', label: '_do(r)', duration: 1.2, delay: 1.3 },
          { path: ['handler', 'hfile'], tone: 'data', label: 'next.handle(r)', duration: 1.2, delay: 2.6 },
        ],
        panel: {
          title: 'Handler base class',
          icon: 'Share2',
          code: 'class Handler(ABC):\n  def __init__(self, next=None):\n    self.next = next\n  def handle(self, r):\n    self._do(r)\n    if self.next:\n      self.next.handle(r)',
        },
        caption: 'Do my part, then pass it on',
      },
      code: {
        language: 'python',
        title: 'v5: handler base and three subclasses',
        source: `import sys

class Handler(ABC):
    def __init__(self, fmt, min_level, next=None):
        self.fmt, self.min, self.next = fmt, min_level, next

    def handle(self, r):
        if r.level >= self.min:
            self._do(self.fmt.format(r))
        if self.next:
            self.next.handle(r)

    @abstractmethod
    def _do(self, line): ...

    def close(self):
        if self.next:
            self.next.close()

class ConsoleHandler(Handler):
    def _do(self, line):
        print(line, file=sys.stderr)

class FileHandler(Handler):
    def __init__(self, path, *a, **kw):
        super().__init__(*a, **kw)
        self.f = open(path, "a")
    def _do(self, line):
        self.f.write(line + "\\n"); self.f.flush()
    def close(self):
        self.f.close()
        super().close()

class SlackHandler(Handler):
    def _do(self, line):
        post_to_slack(line)  # network call, about 300 ms

class Logger:  # sync logger: it holds the head of the chain
    def __init__(self, name, chain):
        self.name, self.chain = name, chain

    def log(self, level, msg):
        self.chain.handle(LogRecord(level, self.name, msg))

    def error(self, msg):
        self.log(Level.ERROR, msg)`,
        highlight: [4, 7, 8, 9, 10, 11],
      },
      quiz: {
        question: 'In the handler chain, what does the Logger know about the destinations?',
        options: [
          'Every handler class, so it can call each one',
          'Only the head of the chain, each handler forwards to the next',
          'Nothing, handlers pull records from a shared file',
          'Only the formatters, handlers are hidden',
        ],
        answer: 1,
        explain: 'The logger holds one reference, the head Handler. Each handler does its work and forwards the record. Adding a destination changes the wiring, not the logger.',
      },
    },
    {
      title: 'Wire it up',
      tag: 'case',
      heading: 'Case: one ERROR, three destinations',
      eli5: 'A tiny chatter note is written in the diary only. A loud alarm note is written in the diary, on the board and told to the head teacher. Each desk checks the size on its own.',
      body: [
        'Wire the chain once at startup: console (WARN up, plain), file (INFO up, JSON), Slack (ERROR only). The order is the order of the arrows.',
        'An `INFO` record reaches all three handlers, but only the file keeps it. An `ERROR` is kept by all three. No handler needs to know the others exist.',
      ],
      keyIdea: 'Wiring lives in one place. Filtering lives inside each handler.',
      metrics: { classes: '10', sinks: '3', wait: '301 ms', safe: 'no' },
      metricTones: { sinks: 'good', wait: 'warn', safe: 'bad' },
      scene: {
        nodes: [{ ...hConsole, at: at(-4, -2), chips: [{ text: '>= WARN', tone: 'good' }] }, { ...hFile, at: at(0, -2), chips: [{ text: '>= INFO', tone: 'good' }] }, { ...hSlack, at: at(4, -2), chips: [{ text: '>= ERROR', tone: 'good' }] }],
        links: [link('hcon', 'hfile', 'next'), link('hfile', 'hslack', 'next')],
        flows: [
          { path: ['hcon', 'hfile', 'hslack'], tone: 'request', label: 'ERROR', duration: 2.2 },
          { path: ['hcon', 'hfile'], tone: 'data', label: 'INFO', duration: 1.6, delay: 2.4 },
        ],
        panel: {
          title: 'Who keeps what',
          icon: 'Table',
          rows: [
            { text: 'DEBUG', value: 'nobody', tone: 'muted' },
            { text: 'INFO', value: 'file', tone: 'good' },
            { text: 'WARN', value: 'file, console', tone: 'good' },
            { text: 'ERROR', value: 'file, console, Slack', tone: 'good' },
          ],
        },
        caption: 'Each handler filters for itself',
      },
      code: {
        language: 'python',
        title: 'Wire the chain at startup',
        source: `json_fmt, plain = JsonFormatter(), PlainFormatter()

chain = ConsoleHandler(plain, Level.WARN,
    next=FileHandler("/var/log/app.log", json_fmt, Level.INFO,
        next=SlackHandler(plain, Level.ERROR)))

log = Logger("payments", chain)
log.error("card declined")`,
        highlight: [3, 4, 5],
      },
    },
    {
      title: 'Chain or list',
      tag: 'tradeoff',
      heading: 'Chain of Responsibility or a plain list of handlers',
      eli5: 'Passing the card desk to desk works. A tray where the secretary drops a copy at each desk works too, and it is easier to add a new desk.',
      body: [
        'The classic chain lets a link **stop** the request. A logger never stops: every handler sees every record, so the chain is really a pipeline with a `next` pointer.',
        'A list (`for h in handlers: h.handle(r)`) is simpler. It adds or removes a destination without relinking, and one handler cannot hide the rest. Python\'s `logging` module uses a list. Keep the chain only when handlers may veto the record.',
      ],
      keyIdea: 'If no handler ever stops the record, a list says the same thing with less wiring.',
      metrics: { classes: '10', sinks: '3', wait: '301 ms', safe: 'no' },
      metricTones: { sinks: 'good', wait: 'warn', safe: 'bad' },
      scene: {
        nodes: [
          { id: 'chain', kind: 'block', at: at(-4, -2), label: 'Chain', sub: 'next pointers', icon: 'Route', tint: 'blue' },
          { id: 'list', kind: 'block', at: at(4, -2), label: 'List', sub: 'for h in handlers', icon: 'List', tint: 'green', status: 'active' },
          { ...logger, at: at(0, 2) },
        ],
        links: [link('logger', 'chain', 'head only'), link('logger', 'list', 'iterates')],
        flows: [{ path: ['logger', 'list'], tone: 'request', label: 'handle(r)', duration: 1.5 }],
        panel: {
          title: 'Compare',
          icon: 'Scale',
          rows: [
            { text: 'Add a sink', value: 'chain: relink, list: append' },
            { text: 'Veto a record', value: 'chain: yes, list: no' },
            { text: 'One bad handler', value: 'chain: breaks the rest', tone: 'warn' },
          ],
        },
        caption: 'Same behavior, different wiring',
      },
    },
    {
      title: 'Slow sink',
      tag: 'problem',
      heading: 'The pain: Slack takes 300 ms and the caller waits',
      eli5: 'The class secretary must walk to the head teacher\'s room for every alarm. While she walks, the whole class stands still and waits for her to come back.',
      body: [
        '`log.error()` runs inside the request thread. The Slack call is a network round trip of about 300 ms. A user clicks Pay and waits an extra 300 ms for a message they never see.',
        'A slow or stuck sink can also hang the app. Logging must never make the product slower or less safe than it was. The caller should hand off and move on.',
      ],
      keyIdea: 'Logging runs on the hot path. A slow destination must not hold up the caller.',
      metrics: { classes: '10', sinks: '3', wait: '301 ms', safe: 'no' },
      metricTones: { wait: 'bad', safe: 'bad' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -2), status: 'hot', load: 90, chips: [{ text: 'waiting 300 ms', tone: 'bad' }] },
          { ...logger, at: at(0, -2) },
          { ...hSlack, at: at(4, -2), status: 'hot' },
          { ...slack, at: at(4, 4) },
        ],
        links: [link('app', 'logger', 'calls'), link('logger', 'hslack', 'sync'), link('hslack', 'slack', '300 ms', { labelTone: 'warn' })],
        flows: [
          { path: ['app', 'logger', 'hslack', 'slack'], tone: 'request', label: 'error()', duration: 2.2 },
          { path: ['slack', 'hslack', 'logger', 'app'], tone: 'response', label: 'ok', duration: 2.2, delay: 2.4 },
        ],
        panel: {
          title: 'One request',
          icon: 'Timer',
          rows: [
            { text: 'Business work', value: '5 ms', tone: 'good' },
            { text: 'Console and file logging', value: '1 ms' },
            { text: 'Slack call logging', value: '300 ms', tone: 'bad' },
          ],
          footer: { text: 'Logging wait 301 ms of 306 ms total, 98%', tone: 'bad' },
        },
        caption: 'The caller pays for every sink',
      },
    },
    {
      title: 'Queue',
      tag: 'concept',
      heading: 'v6: a queue between the caller and the sinks',
      eli5: 'Now the secretary drops the note into a mailbox on the door and goes back to class. A helper kid empties the mailbox and does the slow walking.',
      body: [
        '`AsyncLogger` puts the record on a **bounded queue** and returns at once. One background **worker** thread takes records off the queue and runs the handler chain.',
        'This is **producer-consumer**. Callers are producers, the worker is the single consumer. The caller now pays about the cost of a queue `put`, which is microseconds.',
      ],
      keyIdea: 'Hand the record to a queue and return. The slow work happens on a thread nobody is waiting on.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'no' },
      metricTones: { wait: 'good', safe: 'bad' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -2) },
          { ...logger, at: at(0, -2), label: 'AsyncLogger', status: 'active' },
          { ...queue, at: at(4, -2) },
          { ...worker, at: at(4, 2) },
        ],
        links: [link('app', 'logger', 'calls'), link('logger', 'queue', 'put'), link('worker', 'queue', 'get')],
        flows: [
          { path: ['app', 'logger', 'queue'], tone: 'request', label: 'put(r)', duration: 1.6 },
          { path: ['queue', 'worker'], tone: 'event', label: 'chain.handle(r)', duration: 1.6, delay: 1.7 },
        ],
        panel: {
          title: 'Who runs what',
          icon: 'Workflow',
          rows: [
            { text: 'Request thread', value: 'build record, put' },
            { text: 'Worker thread', value: 'format, write, Slack' },
            { text: 'Caller wait', value: '~20 microseconds', tone: 'good' },
          ],
        },
        caption: 'Producers enqueue, one consumer drains',
      },
    },
    {
      title: 'AsyncLogger',
      tag: 'concept',
      heading: 'The AsyncLogger in code',
      eli5: 'The mailbox has a flap that never sticks. The secretary drops the card and walks away. A helper kid sits by the mailbox and does the slow jobs.',
      body: [
        '`log()` builds the `LogRecord` on the caller thread, so the timestamp and thread name are right, then calls `put_nowait`. The worker loop uses `get(timeout=0.1)` so it can notice a stop flag.',
        'The worker is a **daemon** thread, so it never keeps the process alive by itself. We will handle a clean exit in a moment.',
      ],
      keyIdea: 'Build the record on the caller thread. Do the slow work on the worker.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'no' },
      metricTones: { wait: 'good', safe: 'bad' },
      scene: {
        nodes: [{ ...logger, at: at(-4, -2), label: 'AsyncLogger', status: 'active' }, { ...queue, at: at(0, -2) }, { ...worker, at: at(4, -2) }, { ...handler, at: at(4, 6), label: 'Handler chain', sub: 'head' }],
        links: [link('logger', 'queue', 'put_nowait'), link('worker', 'queue', 'get'), link('worker', 'handler', 'calls')],
        flows: [
          { path: ['logger', 'queue'], tone: 'request', label: 'put_nowait', duration: 1.3 },
          { path: ['queue', 'worker', 'handler'], tone: 'event', label: 'handle(r)', duration: 1.8, delay: 1.4 },
        ],
        panel: {
          title: 'Two loops',
          icon: 'Repeat',
          code: 'log():   put_nowait(record)\n_drain(): while not stop:\n  r = q.get(timeout=0.1)\n  chain.handle(r)',
        },
        caption: 'put on one side, get on the other',
      },
      code: {
        language: 'python',
        title: 'v6: AsyncLogger',
        source: `import queue, threading

class AsyncLogger:
    def __init__(self, name, chain, size=10_000):
        self.name, self.chain = name, chain
        self.q = queue.Queue(maxsize=size)
        self.stop = threading.Event()
        self.closing = False
        self.dropped = 0
        self.drop_lock = threading.Lock()
        self.worker = threading.Thread(target=self._drain, daemon=True)
        self.worker.start()

    def log(self, level, msg):
        r = LogRecord(level, self.name, msg)  # built on the caller thread
        try:
            self.q.put_nowait(r)
        except queue.Full:
            with self.drop_lock:  # += is not atomic across threads
                self.dropped += 1

    def _drain(self):
        while not self.stop.is_set() or not self.q.empty():
            try:
                r = self.q.get(timeout=0.1)
            except queue.Empty:
                continue
            self.chain.handle(r)
            self.q.task_done()`,
        highlight: [14, 15, 16, 17, 18, 19, 24, 27],
      },
    },
    {
      title: 'Full queue',
      tag: 'tradeoff',
      heading: 'What happens when the queue is full',
      eli5: 'The mailbox is small. If it overflows, the secretary can throw the newest note away, wait at the door, or toss out the oldest note. Each choice costs something.',
      body: [
        'The sinks may be slower than the producers for a while. A bounded queue stops memory growing without limit. Then you must pick a policy when it fills.',
        '**Drop** keeps the app fast and loses lines. **Block** keeps every line and stalls callers, which is the 300 ms pain again. A common middle: drop `DEBUG` and `INFO` first, never drop `ERROR`, and count what was dropped.',
      ],
      keyIdea: 'A full queue forces a choice between losing logs and slowing the app. Choose on purpose and count the drops.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'drops counted' },
      metricTones: { wait: 'good', safe: 'warn' },
      scene: {
        nodes: [
          { ...logger, at: at(-4, -2), label: 'AsyncLogger', chips: [{ text: 'dropped: 214', tone: 'warn' }] },
          { ...queue, at: at(0, -2), status: 'hot', load: 100, chips: [{ text: '10,000 / 10,000', tone: 'bad' }] },
          { ...worker, at: at(4, -2), status: 'hot' },
        ],
        links: [link('logger', 'queue', 'put_nowait'), link('worker', 'queue', 'get')],
        flows: [{ path: ['logger', 'queue'], tone: 'error', label: 'queue.Full', duration: 1.6 }],
        panel: {
          title: 'Full-queue policies',
          icon: 'Scale',
          rows: [
            { text: 'Drop newest', value: 'fast, loses lines', tone: 'warn' },
            { text: 'Drop oldest', value: 'fast, keeps recent' },
            { text: 'Block caller', value: 'no loss, app stalls', tone: 'bad' },
            { text: 'Never drop ERROR', value: 'reserve for errors', tone: 'good' },
          ],
        },
        caption: 'Bounded queues need a policy',
      },
    },
    {
      title: 'Shutdown',
      tag: 'case',
      heading: 'Shutdown: flush before you exit',
      eli5: 'When the bell rings, the helper kid must finish the notes still in the mailbox before going home. If not, the last notes explain what went wrong and they are the ones lost.',
      body: [
        'The most useful lines are the last ones, written just before a crash or a deploy. A daemon thread dies with the process, and anything still in the queue dies with it.',
        '`shutdown()` waits for the queue to empty with `q.join()`, then sets the stop flag and joins the worker. Register it at exit so it always runs.',
      ],
      keyIdea: 'Drain the queue on shutdown, or the last lines before a crash are the ones you lose.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'flushes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -2), status: 'dim', chips: ['SIGTERM'] },
          { ...queue, at: at(0, -2), chips: [{ text: '37 left', tone: 'warn' }] },
          { ...worker, at: at(4, -2), status: 'active' },
          { ...file, at: at(4, 6) },
        ],
        links: [link('app', 'queue', 'shutdown()'), link('worker', 'queue', 'get'), link('worker', 'file', 'write')],
        flows: [
          { path: ['app', 'queue'], tone: 'request', label: 'join()', duration: 1.4 },
          { path: ['queue', 'worker', 'file'], tone: 'data', label: 'flush 37', count: 3, duration: 2, delay: 1.5 },
        ],
        panel: {
          title: 'Clean exit order',
          icon: 'List',
          rows: [
            { text: '1', value: 'stop accepting new logs' },
            { text: '2', value: 'q.join() until empty' },
            { text: '3', value: 'set stop, join worker' },
            { text: '4', value: 'close files', tone: 'good' },
          ],
        },
        caption: 'Empty the mailbox, then exit',
      },
      code: {
        language: 'python',
        title: 'Flush on exit',
        source: `import atexit

class AsyncLogger:
    ...
    def log(self, level, msg):
        if self.closing:     # reject new records once shutdown starts
            return
        ...

    def shutdown(self):
        self.closing = True  # set first, so the queue can drain
        self.q.join()        # wait until every record is handled
        self.stop.set()
        self.worker.join(timeout=2)
        self.chain.close()   # close files after the worker is done

# in setup code
atexit.register(logger.shutdown)`,
        highlight: [5, 6, 9, 10, 11, 12, 13, 16],
      },
    },
    {
      title: 'Threads',
      tag: 'concept',
      heading: 'Thread safety: who needs a lock',
      eli5: 'Many kids drop notes in the mailbox at once and the mailbox handles it. Only one helper kid writes in the diary, so two pens never fight over the same line.',
      body: [
        '`queue.Queue` is already thread safe, so producers need no lock around the queue. The `dropped` counter is shared state, so it gets a small `Lock`, or the count would only be approximate. With one consumer, handlers run on a single thread, so the file handle is never written by two threads at once.',
        'The synchronous `Logger` from v5 has no such guard. Two request threads can interleave half-written lines. Put a `threading.Lock` around the handler write there. Shared state gets one owner or one lock.',
      ],
      keyIdea: 'One consumer thread is a lock-free design. If several threads write one file, guard the write.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { id: 't1', kind: 'worker', at: at(-4, -3), label: 'Thread A', sub: 'producer' },
          { id: 't2', kind: 'worker', at: at(-4, 3), label: 'Thread B', sub: 'producer' },
          { ...queue, at: at(0, 0), chips: [{ text: 'thread safe', tone: 'good' }] },
          { ...worker, at: at(4, 0), status: 'ok', sub: 'only writer' },
        ],
        links: [link('t1', 'queue', 'put'), link('t2', 'queue', 'put'), link('worker', 'queue', 'get')],
        flows: [
          { path: ['t1', 'queue'], tone: 'request', label: 'put', duration: 1.2 },
          { path: ['t2', 'queue'], tone: 'request', label: 'put', duration: 1.2, delay: 0.2 },
          { path: ['queue', 'worker'], tone: 'event', label: 'one at a time', duration: 1.4, delay: 1.4 },
        ],
        panel: {
          title: 'Where a lock is needed',
          icon: 'Shield',
          rows: [
            { text: 'Queue put and get', value: 'built in', tone: 'good' },
            { text: 'Single consumer', value: 'none needed', tone: 'good' },
            { text: 'Sync FileHandler', value: 'Lock around write', tone: 'warn' },
          ],
        },
        caption: 'Many producers, one writer',
      },
      quiz: {
        question: 'Why does the async design need no lock around the file write?',
        options: [
          'The OS locks every file automatically',
          'Only the single worker thread ever writes the file',
          'Python threads cannot run at the same time',
          'The queue copies the file for each producer',
        ],
        answer: 1,
        explain: 'Producers only touch the thread-safe queue. One consumer thread runs every handler, so no two threads write the file together. A synchronous logger with many writers does need a lock.',
      },
    },
    {
      title: 'Bad handler',
      tag: 'case',
      heading: 'A failing handler must not take the app down',
      eli5: 'If the head teacher\'s door is locked, the helper kid should not drop everything. The kid leaves a small note about the locked door and carries on with the other desks.',
      body: [
        'Slack can time out. The disk can fill. If `_do` raises inside the worker loop, the exception kills the thread and logging stops silently. In the chain, an early failure also skips every later handler.',
        'Wrap each handler call in `try/except`, send the problem to a last-resort `stderr` line, and keep going. A logger must never crash the thing it is watching.',
      ],
      keyIdea: 'Catch handler errors at the boundary, report them somewhere simple, and keep the logger alive.',
      metrics: { classes: '12', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { safe: 'good' },
      scene: {
        nodes: [
          { ...worker, at: at(-4, -2) },
          { ...hSlack, at: at(0, -2), status: 'down' },
          { ...hFile, at: at(4, -2), status: 'ok' },
        ],
        links: [link('worker', 'hslack', 'calls'), link('hslack', 'hfile', 'next')],
        flows: [
          { path: ['worker', 'hslack'], tone: 'error', label: 'TimeoutError', duration: 1.4 },
          { path: ['worker', 'hfile'], tone: 'data', label: 'still written', duration: 1.8, delay: 1.5 },
        ],
        panel: {
          title: 'Guard in the base class',
          icon: 'Shield',
          code: 'def handle(self, r):\n  try:\n    self._do(self.fmt.format(r))\n  except Exception as e:\n    print("log failed:", e,\n          file=sys.stderr)\n  if self.next: self.next.handle(r)',
        },
        caption: 'One sink fails, the others live',
      },
    },
    {
      title: 'Global access',
      tag: 'concept',
      heading: 'One shared logger per name, through a registry',
      eli5: 'Every class in school should write to the same class diary, not start its own. The secretary keeps a shelf, and anyone who asks for the diary named "payments" gets that one.',
      body: [
        'Passing a logger into every constructor is tedious. A `get_logger(name)` function looks up a **registry** dict and creates the logger on first use. Same name, same object. This is a **Singleton** per name.',
        'A single process-wide instance is easy but hard to test. Prefer the registry, build it once at startup, and let tests pass a different handler. The lookup needs a lock so two threads never create two loggers.',
      ],
      keyIdea: 'A registry gives global access without a hardcoded global. Same name always returns the same logger.',
      metrics: { classes: '13', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { classes: 'good', safe: 'good' },
      scene: {
        nodes: [
          { id: 'registry', kind: 'block', at: at(0, -2), label: 'Registry', sub: 'name to logger', icon: 'Hash', tint: 'green', status: 'active' },
          { id: 'pay', kind: 'block', at: at(-4, 4), label: 'payments', sub: 'AsyncLogger', icon: 'FileText', tint: 'green' },
          { id: 'auth', kind: 'block', at: at(4, 4), label: 'auth', sub: 'AsyncLogger', icon: 'FileText', tint: 'green' },
          { ...app, at: at(-4, -2) },
        ],
        links: [link('app', 'registry', 'get_logger'), link('registry', 'pay', 'has-a'), link('registry', 'auth', 'has-a')],
        flows: [
          { path: ['app', 'registry'], tone: 'request', label: 'get_logger("payments")', duration: 1.6 },
          { path: ['registry', 'pay'], tone: 'response', label: 'same instance', duration: 1.4, delay: 1.7 },
        ],
        panel: {
          title: 'get_logger',
          icon: 'Code',
          code: '_loggers, _lock = {}, Lock()\n\ndef get_logger(name):\n  with _lock:\n    if name not in _loggers:\n      _loggers[name] = make(name)\n    return _loggers[name]',
        },
        caption: 'Lookup by name, create once',
      },
    },
    {
      title: 'Rotation',
      tag: 'concept',
      heading: 'Rotate files so the disk does not fill',
      eli5: 'A diary has a limited number of pages. When it is full, the secretary starts a new diary and tucks the old one away. After a few, she throws the oldest one out.',
      body: [
        'A single file grows forever. A **rotating file handler** checks its size after each write. Past a limit, say 100 MB, it renames `app.log` to `app.log.1` and shifts older ones up.',
        'Keep a fixed number of backups, such as 5, and delete the oldest. Disk use is bounded at about 600 MB. Time-based rotation, one file per day, is the same idea with a clock instead of a size. It is just another `Handler` subclass.',
      ],
      keyIdea: 'Rotation bounds disk use. It belongs inside one handler, so nothing else changes.',
      metrics: { classes: '14', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { classes: 'good', safe: 'good' },
      scene: {
        nodes: [
          { id: 'rot', kind: 'block', at: at(-4, -2), label: 'RotatingFileHandler', sub: 'extends FileHandler', icon: 'Repeat', tint: 'green', status: 'active' },
          { id: 'cur', kind: 'block', at: at(0, -2), label: 'app.log', sub: '100 MB, full', icon: 'FileText', tint: 'amber' },
          { id: 'old', kind: 'block', at: at(4, -2), label: 'app.log.1 ... .5', sub: 'oldest deleted', icon: 'HardDrive', tint: 'gray' },
        ],
        links: [link('rot', 'cur', 'writes'), link('cur', 'old', 'renamed to')],
        flows: [
          { path: ['rot', 'cur'], tone: 'data', label: 'write', duration: 1.3 },
          { path: ['cur', 'old'], tone: 'event', label: 'rollover', duration: 1.5, delay: 1.5 },
        ],
        panel: {
          title: 'Rollover',
          icon: 'Repeat',
          code: 'if self.f.tell() > MAX_BYTES:\n  self.f.close()\n  for i in range(KEEP - 1, 0, -1):\n    rename(f"{p}.{i}", f"{p}.{i+1}")\n  rename(p, f"{p}.1")\n  self.f = open(p, "a")',
        },
        caption: 'Full file moves aside, new one starts',
      },
    },
    {
      title: 'Testing',
      tag: 'case',
      heading: 'Test it with a MemoryHandler',
      eli5: 'To check the secretary works, give her a toy notebook that just sits on the desk. After she writes, you open the toy notebook and read what is inside.',
      body: [
        'Because the logger depends on the `Handler` abstraction, a test injects a `MemoryHandler` that appends lines to a list. No files, no network, no sleeping.',
        'Assert on the list. To test the async path, call `shutdown()` first so the queue is drained before you look. This is **dependency injection**: the class receives its collaborators.',
      ],
      keyIdea: 'Depend on the interface, inject a fake, and assert on what it captured.',
      metrics: { classes: '15', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { classes: 'good', safe: 'good' },
      scene: {
        nodes: [
          { id: 'test', kind: 'block', at: at(-4, -2), label: 'Test', sub: 'assert on lines', icon: 'Bug', tint: 'amber' },
          { ...logger, at: at(0, -2), label: 'AsyncLogger' },
          { id: 'mem', kind: 'block', at: at(4, -2), label: 'MemoryHandler', sub: 'concrete class', icon: 'List', tint: 'green', status: 'ok', chips: ['lines: 1'] },
        ],
        links: [link('test', 'logger', 'calls'), link('logger', 'mem', 'creates records for', { style: 'dashed' }), link('mem', 'handler', 'extends', { style: 'faint' })].slice(0, 2),
        flows: [
          { path: ['test', 'logger'], tone: 'request', label: 'error("boom")', duration: 1.3 },
          { path: ['logger', 'mem'], tone: 'event', label: 'handle(r)', duration: 1.3, delay: 1.4 },
        ],
        panel: {
          title: 'A test',
          icon: 'Code',
          code: 'mem = MemoryHandler(plain, Level.INFO)\nlog = AsyncLogger("t", mem)\nlog.log(Level.ERROR, "boom")\nlog.shutdown()\nassert "boom" in mem.lines[0]',
        },
        caption: 'Swap the real sink for a fake',
      },
    },
    {
      title: 'Whole design',
      tag: 'concept',
      heading: 'The final class diagram',
      eli5: 'The class has a secretary, a mailbox, a helper kid and a row of desks. Cards are passed through. Each part has one job, so you can swap one without touching the others.',
      body: [
        '`AsyncLogger` creates `LogRecord`s and queues them. The worker feeds the `Handler` chain. Each handler owns a `Formatter` and a level, and writes to one destination.',
        'Patterns are named after the pain they solved: enum levels for noise, Strategy for formats, Chain of Responsibility for destinations, producer-consumer for slow sinks, a registry for access.',
      ],
      keyIdea: 'Each class has one reason to change, and each pattern was added to fix a pain we could see.',
      metrics: { classes: '15', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { classes: 'good', sinks: 'good', wait: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...logger, at: at(-4, -2), label: 'AsyncLogger' },
          { ...record, at: at(0, -2) },
          { ...handler, at: at(4, -2) },
          { ...fmt, at: at(0, 4) },
        ],
        links: [link('logger', 'record', 'creates'), link('logger', 'handler', 'has-a'), link('handler', 'fmt', 'has-a')],
        flows: [
          { path: ['logger', 'record'], tone: 'request', label: 'LogRecord', duration: 1.2 },
          { path: ['logger', 'handler'], tone: 'event', label: 'handle(r)', duration: 1.6, delay: 1.3 },
          { path: ['handler', 'fmt'], tone: 'request', label: 'format(r)', duration: 1.2, delay: 3 },
        ],
        panel: {
          title: 'Pain to pattern',
          icon: 'Table',
          rows: [
            { text: 'Debug spam', value: 'Level enum' },
            { text: 'Many formats', value: 'Strategy' },
            { text: 'Many sinks', value: 'Chain' },
            { text: 'Slow sink', value: 'Producer-consumer' },
            { text: 'Global access', value: 'Registry' },
          ],
        },
        caption: 'Five pains, five small designs',
      },
    },
    {
      title: 'Recap',
      tag: 'recap',
      heading: 'Recap: a logger built one pain at a time',
      eli5: 'The class secretary writes cards, the helper kid walks them to each desk, and each desk keeps what it wants. Everyone can still go to recess without waiting.',
      body: [
        'Start with `print`, persist to a file, add **levels**, wrap facts in a **LogRecord**, then swap formats with **Strategy** and destinations with a **chain** of handlers.',
        'Keep slow sinks off the caller with a **bounded queue and one worker**. Pick a full-queue policy, flush on shutdown, isolate handler failures, rotate files and inject a memory handler in tests.',
      ],
      keyIdea: 'Logging runs on the hot path. Make it cheap for the caller, safe when sinks fail and easy to swap in a test.',
      metrics: { classes: '15', sinks: '3', wait: '0.02 ms', safe: 'yes' },
      metricTones: { classes: 'good', sinks: 'good', wait: 'good', safe: 'good' },
      scene: {
        nodes: [
          { ...app, at: at(-4, -2) },
          { ...logger, at: at(0, -2), label: 'AsyncLogger', status: 'ok' },
          { ...queue, at: at(4, -2) },
          { ...worker, at: at(4, 2) },
        ],
        links: [link('app', 'logger', 'calls'), link('logger', 'queue', 'put'), link('worker', 'queue', 'get')],
        flows: [
          { path: ['app', 'logger', 'queue'], tone: 'request', label: 'log()', duration: 1.5 },
          { path: ['queue', 'worker'], tone: 'event', label: 'handlers', duration: 1.5, delay: 1.6 },
        ],
        panel: {
          title: 'Checklist',
          icon: 'ListChecks',
          rows: [
            { text: 'Levels and LogRecord', value: 'done', tone: 'good' },
            { text: 'Strategy and Chain', value: 'done', tone: 'good' },
            { text: 'Async queue', value: 'done', tone: 'good' },
            { text: 'Flush, guard, rotate', value: 'done', tone: 'good' },
          ],
        },
        caption: 'Fast for the caller, safe for the app',
      },
      quiz: {
        question: 'Callers of log.error() see 300 ms delays because Slack is slow. What is the best fix?',
        options: [
          'Raise the minimum level so Slack never runs',
          'Add a lock around the Slack handler',
          'Queue the record and let one worker thread call the handlers',
          'Make the formatter faster',
        ],
        answer: 2,
        explain: 'The delay comes from a slow sink running on the caller thread. A bounded queue and a worker thread move that work off the hot path. Locks and faster formatting do not change who waits.',
      },
    },
  ],
};
