function setFlag(obj, key, val) {
    if (val)
        obj[key] = true;
}
export function toWireNote(n) {
    const w = { t: n.time, s: n.string, f: n.fret };
    if (n.sustain)
        w.sus = n.sustain;
    if (n.slideTo >= 0)
        w.sl = n.slideTo;
    if (n.slideUnpitchTo >= 0)
        w.sl2 = n.slideUnpitchTo;
    if (n.bend)
        w.bn = n.bend;
    setFlag(w, "ho", n.hammerOn);
    setFlag(w, "po", n.pullOff);
    setFlag(w, "hm", n.harmonic);
    setFlag(w, "hp", n.harmonicPinch);
    setFlag(w, "pm", n.palmMute);
    setFlag(w, "mu", n.mute);
    setFlag(w, "vb", n.vibrato);
    setFlag(w, "tr", n.tremolo);
    setFlag(w, "ac", n.accent);
    setFlag(w, "ln", n.linkNext);
    setFlag(w, "tap", n.tap);
    return w;
}
export function toWireChordNote(n) {
    const w = { s: n.string, f: n.fret };
    if (n.sustain)
        w.sus = n.sustain;
    if (n.slideTo >= 0)
        w.sl = n.slideTo;
    if (n.slideUnpitchTo >= 0)
        w.sl2 = n.slideUnpitchTo;
    if (n.bend)
        w.bn = n.bend;
    setFlag(w, "ho", n.hammerOn);
    setFlag(w, "po", n.pullOff);
    setFlag(w, "pm", n.palmMute);
    setFlag(w, "mu", n.mute);
    setFlag(w, "vb", n.vibrato);
    setFlag(w, "tr", n.tremolo);
    setFlag(w, "ac", n.accent);
    setFlag(w, "ln", n.linkNext);
    setFlag(w, "tap", n.tap);
    return w;
}
export function toWireChord(c) {
    const w = { t: c.time, id: c.chordId, notes: c.notes.map(toWireChordNote) };
    if (c.highDensity)
        w.hd = true;
    return w;
}
export function toWireAnchor(a) {
    return { time: a.time, fret: a.fret, width: a.width };
}
export function toWireHandShape(h) {
    const w = { id: h.chordId, st: h.startTime, et: h.endTime };
    if (h.arpeggio)
        w.arp = true;
    return w;
}
export function toWireChordTemplate(ct) {
    const w = { name: ct.name, fingers: ct.fingers, frets: ct.frets };
    if (ct.displayName)
        w.displayName = ct.displayName;
    if (ct.arpeggio)
        w.arp = true;
    return w;
}
export function toWirePhrase(p) {
    return {
        start_time: p.startTime,
        end_time: p.endTime,
        max_difficulty: p.maxDifficulty,
        levels: p.levels.map((l) => ({
            difficulty: l.difficulty,
            notes: l.notes.map(toWireNote),
            chords: l.chords.map(toWireChord),
            anchors: l.anchors.map(toWireAnchor),
            handshapes: l.handShapes.map(toWireHandShape),
        })),
    };
}
function valOr(a, b, fallback) {
    if (a !== undefined)
        return a;
    if (b !== undefined)
        return b;
    return fallback;
}
export function noteFromWire(d) {
    return {
        time: d.t,
        string: d.s,
        fret: d.f,
        sustain: d.sus ?? 0,
        slideTo: d.sl ?? -1,
        slideUnpitchTo: valOr(d.sl2, d.slu, -1),
        bend: d.bn ?? 0,
        hammerOn: (d.ho ?? false) === true,
        pullOff: (d.po ?? false) === true,
        harmonic: (d.hm ?? false) === true,
        harmonicPinch: (d.hp ?? false) === true,
        palmMute: (d.pm ?? false) === true,
        mute: valOr(d.mu, d.mt, false) === true,
        vibrato: (d.vb ?? false) === true,
        tremolo: (d.tr ?? false) === true,
        accent: (d.ac ?? false) === true,
        linkNext: (d.ln ?? false) === true,
        tap: valOr(d.tap, d.tp, false) === true,
    };
}
export function chordNoteFromWire(d, chordTime) {
    return {
        string: d.s,
        fret: d.f,
        sustain: d.sus ?? 0,
        slideTo: d.sl ?? -1,
        slideUnpitchTo: valOr(d.sl2, d.slu, -1),
        bend: d.bn ?? 0,
        hammerOn: (d.ho ?? false) === true,
        pullOff: (d.po ?? false) === true,
        harmonic: false,
        harmonicPinch: false,
        palmMute: (d.pm ?? false) === true,
        mute: valOr(d.mu, d.mt, false) === true,
        vibrato: (d.vb ?? false) === true,
        tremolo: (d.tr ?? false) === true,
        accent: (d.ac ?? false) === true,
        linkNext: (d.ln ?? false) === true,
        tap: valOr(d.tap, d.tp, false) === true,
    };
}
export function arrangementStringCount(arr) {
    const nameBased = arr.name.toLowerCase().includes("bass") ? 4 : 6;
    const fromTuning = arr.tuning.length !== 6 ? arr.tuning.length : 0;
    let maxStr = 0;
    for (const n of arr.notes)
        if (n.string > maxStr)
            maxStr = n.string;
    for (const c of arr.chords)
        for (const n of c.notes)
            if (n.string > maxStr)
                maxStr = n.string;
    return Math.max(maxStr + 1, fromTuning || nameBased);
}
//# sourceMappingURL=song.js.map