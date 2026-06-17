export class LibraryService {
    songs;
    favorites;
    constructor(songs, favorites) {
        this.songs = songs;
        this.favorites = favorites;
    }
    search(query) {
        return this.songs.search(query);
    }
    artists(opts) {
        return this.songs.artists(opts);
    }
    stats() {
        return this.songs.stats();
    }
    tuningNames() {
        return this.songs.tuningNames();
    }
    toggleFavorite(trackId, profileId) {
        return this.favorites.toggle(trackId, profileId);
    }
    deleteOrphanedSongs() {
        return this.songs.deleteOrphaned();
    }
}
//# sourceMappingURL=LibraryService.js.map