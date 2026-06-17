export var Permissions;
(function (Permissions) {
    Permissions["ADMIN"] = "admin";
    Permissions["UPLOAD"] = "upload";
    Permissions["EDIT_TRACKS"] = "edit_tracks";
    Permissions["DELETE_TRACKS"] = "delete_tracks";
    Permissions["MANAGE_PROFILES"] = "manage_profiles";
    Permissions["MANAGE_PERMISSIONS"] = "manage_permissions";
    Permissions["MANAGE_SETTINGS"] = "manage_settings";
})(Permissions || (Permissions = {}));
export const ALL_PERMISSIONS = Object.values(Permissions);
export const DEFAULT_ADMIN_PERMISSIONS = [
    Permissions.ADMIN,
    Permissions.UPLOAD,
    Permissions.EDIT_TRACKS,
    Permissions.DELETE_TRACKS,
    Permissions.MANAGE_PROFILES,
    Permissions.MANAGE_PERMISSIONS,
    Permissions.MANAGE_SETTINGS,
];
//# sourceMappingURL=permission.js.map