/*
 * Copyright (c) Enalean, 2018. All Rights Reserved.
 *
 * This file is a part of Tuleap.
 *
 * Tuleap is free software; you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation; either version 2 of the License, or
 * (at your option) any later version.
 *
 * Tuleap is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Tuleap. If not, see <http://www.gnu.org/licenses/>.
 */

import { ADDED_GROUP, DELETED_GROUP } from "./side-by-side-line-grouper.js";
import {
    getGroupLines,
    getGroupOfLine,
    getLineHandles,
    hasNextLine,
    getNextLine
} from "./side-by-side-lines-state.js";

function getWidgetCreationParams(line, left_code_mirror, right_code_mirror) {
    if (lineIsUnmoved(line)) {
        const { left_handle, right_handle } = getLineHandles(line);
        if (!right_handle.widgets) {
            return null;
        }

        const widget_height = right_handle.height - left_handle.height;
        return {
            code_mirror: left_code_mirror,
            handle: left_handle,
            widget_height,
            display_above_line: false
        };
    }

    const line_group = getGroupOfLine(line);
    const handle = getOppositeHandle(line, line_group);
    const code_mirror = getCodeMirror(line_group, left_code_mirror, right_code_mirror);
    const group_height = sumGroupLinesHeight(line_group);
    const { widget_height, display_above_line } = adjustWidgetPlacementAndHeight(
        line,
        handle,
        group_height
    );
    return {
        code_mirror,
        handle,
        widget_height,
        display_above_line
    };
}

function getUnmovedLineWidgetCreationParams(line) {
    const { left_handle, right_handle } = getLineHandles(line);

    let widget_height = right_handle.height - left_handle.height;
    const right_placeholder_widget = getPlaceholderWidget(right_handle);
    if (right_placeholder_widget) {
        widget_height -= right_placeholder_widget.height;
    }
    return {
        handle: left_handle,
        widget_height,
        display_above_line: false
    };
}

function getPlaceholderWidget(handle) {
    if (!handle.widgets) {
        return null;
    }
    return handle.widgets.find(widget => {
        return widget.node.classList.contains("pull-request-file-diff-placeholder-block");
    });
}

function getCodeMirror(group, left_code_mirror, right_code_mirror) {
    return group.type === ADDED_GROUP ? left_code_mirror : right_code_mirror;
}

function getOppositeHandle(line, group) {
    if (group.type === ADDED_GROUP) {
        const { left_handle } = getLineHandles(line);
        return left_handle;
    }

    const { right_handle } = getLineHandles(line);
    return right_handle;
}

function getHandle(line, group) {
    if (group.type === ADDED_GROUP) {
        const { right_handle } = getLineHandles(line);
        return right_handle;
    }

    const { left_handle } = getLineHandles(line);
    return left_handle;
}

function sumGroupLinesHeight(group) {
    const group_lines = getGroupLines(group);
    return group_lines.reduce((accumulator, line) => {
        const handle = getHandle(line, group);
        return accumulator + handle.height;
    }, 0);
}

function isFirstLineModified(line) {
    if (line.unidiff_offset > 1 || !hasNextLine(line)) {
        return false;
    }
    const next_line = getNextLine(line);
    const next_line_group = getGroupOfLine(next_line);
    const line_group = getGroupOfLine(line);

    return line_group.type === DELETED_GROUP && next_line_group.type === ADDED_GROUP;
}

function adjustWidgetPlacementAndHeight(line, placeholder_line_handle, widget_height) {
    if (isFirstLineModified(line)) {
        return {
            widget_height,
            display_above_line: true
        };
    }

    if (line.new_offset === 1 || line.old_offset === 1) {
        return {
            widget_height: widget_height - placeholder_line_handle.height,
            display_above_line: false
        };
    }

    return {
        widget_height,
        display_above_line: false
    };
}

function lineIsUnmoved(line) {
    return line.new_offset !== null && line.old_offset !== null;
}

export { getWidgetCreationParams, getUnmovedLineWidgetCreationParams };
