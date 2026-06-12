import './styles/folder-count.css';

import FileExplorerNoteCount from 'main';
import { AbstractFileFilter, getParentPath, isFolder, isParent, iterateItems, withSubfolderClass } from 'misc';
import { AFItem, FolderItem, TFile, TFolder } from 'obsidian';

interface FolderStats {
    count: number;
    size: number;
}

const countFolderChildren = (folder: TFolder, filter: AbstractFileFilter): FolderStats => {
    let count = 0;
    let size = 0;
    for (const af of folder.children) {
        if (filter(af)) {
            count++;
            if (af instanceof TFile) size += af.stat.size;
        }
        if (af instanceof TFolder) {
            const sub = countFolderChildren(af, filter);
            count += sub.count;
            size += sub.size;
        }
    }
    return { count, size };
};

const formatSize = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB', 'TB'];
    let i = 0;
    let value = bytes;
    while (value >= 1024 && i < units.length - 1) {
        value /= 1024;
        i++;
    }
    return (i === 0 ? value.toString() : value.toFixed(1)) + ' ' + units[i];
};

const getDisplayText = (folder: TFolder, plugin: FileExplorerNoteCount): string => {
    const { count, size } = countFolderChildren(folder, plugin.fileFilter);
    return plugin.settings.showFolderSize ? `${count} · ${formatSize(size)}` : count.toString();
};

/** filter out all path that is the parent of existing path */
const filterParent = (pathList: string[]): Set<string> => {
    const list = Array.from(pathList);
    list.sort();
    for (let i = 0; i < list.length; i++) {
        if (i < list.length - 1 && (list[i] === list[i + 1] || isParent(list[i], list[i + 1]))) {
            list.shift();
            i--;
        }
    }
    return new Set(list);
};

/** get all parents and add to set if not exist */
const getAllParents = (path: string, set: Set<string>): void => {
    let parent = getParentPath(path);
    while (parent && !set.has(parent)) {
        set.add(parent);
        parent = getParentPath(parent);
    }
};

/**
 * Update folder count of target's parent
 */
export const updateCount = (targetList: string[], plugin: FileExplorerNoteCount): void => {
    const set = filterParent(targetList);
    for (const path of targetList) {
        getAllParents(path, set);
    }
    // set count of path
    const { fileExplorer } = plugin;
    if (!fileExplorer) {
        console.error('fileExplorer missing');
        return;
    }
    for (const path of set) {
        // check if path available
        if (!fileExplorer.fileItems[path]) continue;
        setCount(fileExplorer.fileItems[path] as FolderItem, plugin);
    }
    // Update root separately
    if (plugin.rootFolderEl && plugin.settings.addRootFolder) {
        setupRootCount(plugin);
    }
    // empty waitingList
    targetList.length = 0;
};

const setupRootCount = (plugin: FileExplorerNoteCount) => {
    if (plugin.rootFolderEl) {
        let rootFolderElChildren = plugin.rootFolderEl.children;
        if (rootFolderElChildren && rootFolderElChildren.length > 0) {
            const rootFolder = plugin.app.vault.getAbstractFileByPath('/') as TFolder;
            rootFolderElChildren[0].setAttr('data-count', getDisplayText(rootFolder, plugin));
        }
    }
};

export const setupCount = (plugin: FileExplorerNoteCount, revert = false) => {
    if (!plugin.fileExplorer) throw new Error('fileExplorer not found');
    // For each setup, first setup the root folder
    plugin.setupRootFolder();
    setupRootCount(plugin);
    // Iterate other items and include new counts
    iterateItems(plugin.fileExplorer.fileItems, (item: AFItem) => {
        if (!isFolder(item)) return;
        if (revert) removeCount(item);
        else setCount(item, plugin);
    });
};

export const setCount = (item: FolderItem, plugin: FileExplorerNoteCount) => {
    // if (item.file.isRoot()) return;
    item.selfEl.dataset['count'] = getDisplayText(item.file, plugin);
    item.selfEl.toggleClass(withSubfolderClass, Array.isArray(item.file.children) && item.file.children.some((af) => af instanceof TFolder));
};

const removeCount = (item: FolderItem) => {
    if (item.selfEl.dataset['count']) delete item.selfEl.dataset['count'];
    item.selfEl.removeClass(withSubfolderClass);
};
