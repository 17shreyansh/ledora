/**
 * widget.js — the script-tag entry point, built as a minified IIFE.
 * document.currentScript is only available while the script is executing, so read it now.
 */
import { start } from './sdk';

start(typeof document !== 'undefined' ? document.currentScript : null);
