import { prisma } from "./client.js";
function rowToMeta(row, favorites, trackIdMap) {
    return {
        filename: row.filename,
        trackId: trackIdMap.get(row.filename) ?? undefined,
        title: row.title,
        artist: row.artist,
        album: row.album,
        year: row.year,
        duration: row.duration,
        tuning: row.tuning,
        tuningName: row.tuningName,
        tuningSortKey: row.tuningSortKey,
        arrangements: row.arrangements,
        hasLyrics: row.hasLyrics,
        format: row.format,
        stemCount: row.stemCount,
        stemIds: row.stemIds,
        mtime: row.mtime,
        favorite: favorites.has(row.filename),
    };
}
function buildOrderBy(sort) {
    switch (sort) {
        case "title": return [{ title: "asc" }, { artist: "asc" }];
        case "title-desc": return [{ title: "desc" }, { artist: "asc" }];
        case "artist": return [{ artist: "asc" }, { title: "asc" }];
        case "artist-desc": return [{ artist: "desc" }, { title: "asc" }];
        case "recent": return [{ mtime: "desc" }];
        case "tuning": return [{ tuningSortKey: "asc" }, { tuningName: "asc" }];
        case "year": return [{ year: "asc" }, { artist: "asc" }];
        case "year-desc": return [{ year: "desc" }, { artist: "asc" }];
    }
}
function buildWhere(query, favorites) {
    const and = [];
    if (query.q) {
        const q = query.q;
        and.push({
            OR: [
                { title: { contains: q } },
                { artist: { contains: q } },
                { album: { contains: q } },
            ],
        });
    }
    if (query.favoritesOnly) {
        and.push({ filename: { in: [...favorites] } });
    }
    if (query.format) {
        and.push({ format: query.format });
    }
    if (query.hasLyrics !== undefined) {
        and.push({ hasLyrics: query.hasLyrics });
    }
    if (query.tunings.length > 0) {
        and.push({ tuningName: { in: [...query.tunings] } });
    }
    return and.length > 0 ? { AND: and } : {};
}
function matchesPostFilters(row, query) {
    const arrNames = row.arrangements.map((a) => a.name.toLowerCase());
    const stemIds = row.stemIds;
    for (const name of query.arrangementsHas) {
        if (!arrNames.some((a) => a.includes(name.toLowerCase())))
            return false;
    }
    for (const name of query.arrangementsLacks) {
        if (arrNames.some((a) => a.includes(name.toLowerCase())))
            return false;
    }
    for (const id of query.stemsHas) {
        if (!stemIds.includes(id))
            return false;
    }
    for (const id of query.stemsLacks) {
        if (stemIds.includes(id))
            return false;
    }
    return true;
}
const hasPostFilters = (q) => q.arrangementsHas.length > 0 ||
    q.arrangementsLacks.length > 0 ||
    q.stemsHas.length > 0 ||
    q.stemsLacks.length > 0;
export class SongRepository {
    async getFavorites() {
        const rows = await prisma.favorite.findMany({ select: { trackId: true } });
        if (rows.length === 0)
            return new Set();
        const trackIds = rows.map((r) => r.trackId);
        const trackDataRows = await prisma.trackData.findMany({
            where: { track: { trackId: { in: trackIds } } },
            select: { originalFilename: true },
        });
        return new Set(trackDataRows.map((r) => r.originalFilename));
    }
    async getTrackIdMap(filenames) {
        const rows = await prisma.trackData.findMany({
            where: { originalFilename: { in: filenames } },
            select: { originalFilename: true, track: { select: { trackId: true } } },
        });
        return new Map(rows.map((r) => [r.originalFilename, r.track.trackId]));
    }
    async getValidFilenames() {
        const rows = await prisma.trackData.findMany({ select: { originalFilename: true } });
        return rows.map((r) => r.originalFilename);
    }
    async search(query) {
        const [favorites, validFilenames] = await Promise.all([
            this.getFavorites(),
            this.getValidFilenames(),
        ]);
        const where = buildWhere(query, favorites);
        const orderBy = buildOrderBy(query.sort);
        const skip = (query.page - 1) * query.size;
        // Restrict to songs that have a corresponding Track (orphaned rows have no TrackData)
        const validSet = { filename: { in: validFilenames } };
        const withValid = where.AND
            ? { AND: [...where.AND, validSet] }
            : Object.keys(where).length
                ? { AND: [where, validSet] }
                : validSet;
        const [rows, total] = await Promise.all([
            prisma.song.findMany({ where: withValid, orderBy }),
            prisma.song.count({ where: withValid }),
        ]);
        const filtered = hasPostFilters(query)
            ? rows.filter((r) => matchesPostFilters(r, query))
            : rows;
        const page = filtered.slice(skip, skip + query.size);
        const trackIdMap = await this.getTrackIdMap(page.map((r) => r.filename));
        return {
            items: page.map((r) => rowToMeta(r, favorites, trackIdMap)),
            total: hasPostFilters(query) ? filtered.length : total,
            page: query.page,
            size: query.size,
        };
    }
    async artists(opts) {
        const favorites = await this.getFavorites();
        const and = [];
        if (opts.letter && opts.letter !== "#") {
            and.push({ artist: { startsWith: opts.letter } });
        }
        if (opts.q) {
            and.push({ artist: { contains: opts.q } });
        }
        if (opts.favoritesOnly) {
            and.push({ filename: { in: [...favorites] } });
        }
        const rows = await prisma.song.findMany({
            where: and.length > 0 ? { AND: and } : undefined,
            orderBy: [{ artist: "asc" }, { album: "asc" }, { title: "asc" }],
        });
        const trackIdMap = await this.getTrackIdMap(rows.map((r) => r.filename));
        const artistMap = new Map();
        for (const row of rows) {
            const meta = rowToMeta(row, favorites, trackIdMap);
            if (!artistMap.has(meta.artist))
                artistMap.set(meta.artist, new Map());
            const albumMap = artistMap.get(meta.artist);
            if (!albumMap.has(meta.album))
                albumMap.set(meta.album, []);
            albumMap.get(meta.album).push(meta);
        }
        const allArtists = [...artistMap.entries()].map(([name, albums]) => ({
            name,
            albums: [...albums.entries()].map(([albumName, songs]) => ({ name: albumName, songs })),
        }));
        const total = allArtists.length;
        const skip = (opts.page - 1) * opts.size;
        return {
            items: allArtists.slice(skip, skip + opts.size),
            total,
            page: opts.page,
            size: opts.size,
        };
    }
    async stats() {
        const [totalSongs, artistRows, songRows] = await Promise.all([
            prisma.song.count(),
            prisma.song.findMany({ select: { artist: true }, distinct: ["artist"] }),
            prisma.song.findMany({ select: { artist: true } }),
        ]);
        const letters = {};
        for (const { artist } of songRows) {
            const first = artist[0]?.toUpperCase() ?? "";
            const key = /[A-Z]/.test(first) ? first : "#";
            letters[key] = (letters[key] ?? 0) + 1;
        }
        return { totalSongs, totalArtists: artistRows.length, letters };
    }
    async tuningNames() {
        const rows = await prisma.song.groupBy({
            by: ["tuningName"],
            _count: { tuningName: true },
            orderBy: { _count: { tuningName: "desc" } },
        });
        return rows.map((r) => ({ name: r.tuningName, count: r._count.tuningName }));
    }
    async findByFilename(filename) {
        const row = await prisma.song.findUnique({ where: { filename } });
        if (!row)
            return null;
        const favorites = await this.getFavorites();
        const trackIdMap = await this.getTrackIdMap([row.filename]);
        return rowToMeta(row, favorites, trackIdMap);
    }
    async findCached(filename, mtime, size) {
        const row = await prisma.song.findUnique({ where: { filename } });
        if (!row || row.mtime !== mtime || row.size !== size)
            return null;
        const favorites = await this.getFavorites();
        const trackIdMap = await this.getTrackIdMap([row.filename]);
        return rowToMeta(row, favorites, trackIdMap);
    }
    async upsert(filename, input) {
        const data = {
            mtime: input.mtime,
            size: input.size,
            title: input.title,
            artist: input.artist,
            album: input.album,
            year: input.year,
            duration: input.duration,
            tuning: input.tuning,
            tuningName: input.tuningName,
            tuningSortKey: input.tuningSortKey,
            arrangements: input.arrangements,
            hasLyrics: input.hasLyrics,
            format: input.format,
            stemCount: input.stemCount,
            stemIds: input.stemIds,
        };
        await prisma.song.upsert({
            where: { filename },
            update: data,
            create: { filename, ...data },
        });
    }
    async delete(filename) {
        await prisma.song.delete({ where: { filename } }).catch(() => undefined);
    }
    async deleteStale(keepFilenames) {
        const existing = await prisma.song.findMany({ select: { filename: true } });
        const toDelete = existing
            .map((r) => r.filename)
            .filter((f) => !keepFilenames.has(f));
        if (toDelete.length > 0) {
            await prisma.song.deleteMany({ where: { filename: { in: toDelete } } });
        }
        return toDelete.length;
    }
    async deleteOrphaned() {
        const [allSongs, trackDataFilenames] = await Promise.all([
            prisma.song.findMany({ select: { filename: true } }),
            prisma.trackData.findMany({ select: { originalFilename: true } }),
        ]);
        const valid = new Set(trackDataFilenames.map((r) => r.originalFilename));
        const orphaned = allSongs.map((r) => r.filename).filter((f) => !valid.has(f));
        if (orphaned.length === 0)
            return 0;
        await prisma.song.deleteMany({ where: { filename: { in: orphaned } } });
        return orphaned.length;
    }
}
//# sourceMappingURL=SongRepository.js.map