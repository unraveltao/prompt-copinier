const SLASH_PICKER_STYLE_ID = 'prompt-copinier-slash-picker-style';

const SLASH_PICKER_STYLES = `
  .pc-slash-picker {
    position: fixed;
    z-index: 2147483646;
    box-sizing: border-box;
    max-height: min(320px, 55vh);
    overflow-y: auto;
    padding: 6px;
    border: 1px solid #d0d7de;
    border-radius: 10px;
    background: #fff;
    color: #1f2328;
    box-shadow: 0 8px 28px rgba(0, 0, 0, 0.18);
    font: 14px/1.4 system-ui, sans-serif;
  }
  .pc-slash-picker[hidden] { display: none; }
  .pc-slash-picker-heading {
    padding: 6px 9px;
    color: #656d76;
    font-size: 11px;
    font-weight: 650;
    letter-spacing: .04em;
    text-transform: uppercase;
  }
  .pc-slash-picker-option {
    display: flex;
    width: 100%;
    align-items: center;
    justify-content: space-between;
    gap: 14px;
    padding: 9px;
    border: 0;
    border-radius: 7px;
    background: transparent;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
  }
  .pc-slash-picker-option:hover,
  .pc-slash-picker-option[aria-selected="true"] { background: #edf4fb; }
  .pc-slash-picker-title { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .pc-slash-picker-detail {
    flex: 0 0 auto;
    max-width: 45%;
    overflow: hidden;
    color: #656d76;
    font-size: 12px;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  @media (prefers-color-scheme: dark) {
    .pc-slash-picker { border-color: #424a53; background: #20252b; color: #e6edf3; box-shadow: 0 8px 28px rgba(0, 0, 0, .42); }
    .pc-slash-picker-heading, .pc-slash-picker-detail { color: #9da7b3; }
    .pc-slash-picker-option:hover, .pc-slash-picker-option[aria-selected="true"] { background: #303b48; }
  }
`;

class SlashCommandPicker {
  constructor({ getInputBox, onSelect, getPrompts, getFolders, utils }) {
    this.getInputBox = getInputBox;
    this.onSelect = onSelect;
    this.getPrompts = getPrompts;
    this.getFolders = getFolders;
    this.utils = utils;
    this.inputBox = null;
    this.context = null;
    this.matches = [];
    this.prompts = [];
    this.folders = [];
    this.activeIndex = 0;
    this.previousAriaAttributes = null;
    this.element = null;
    this.attached = false;

    this.onInput = (event) => this.refreshFromEvent(event);
    this.onKeyUp = (event) => {
      if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) {
        this.refreshFromEvent(event);
      }
    };
    this.onKeyDown = (event) => this.handleKeyDown(event);
    this.onOutsideMouseDown = (event) => {
      if (!this.isOpen()) return;
      const target = event.target instanceof Node ? event.target : null;
      if (target && (this.element.contains(target) || this.inputBox?.contains(target))) return;
      this.close();
    };
    this.onViewportChange = () => this.position();
  }

  async attach() {
    if (!/(^|\.)chatgpt\.com$|(^|\.)chat\.openai\.com$/i.test(window.location.hostname)) return false;
    if (this.attached) return true;
    this.attached = true;

    if (!document.getElementById(SLASH_PICKER_STYLE_ID)) {
      const style = document.createElement('style');
      style.id = SLASH_PICKER_STYLE_ID;
      style.textContent = SLASH_PICKER_STYLES;
      (document.head || document.documentElement).appendChild(style);
    }

    this.element = document.createElement('div');
    this.element.className = 'pc-slash-picker';
    this.element.id = 'prompt-copinier-slash-picker';
    this.element.setAttribute('role', 'listbox');
    this.element.setAttribute('aria-label', 'Prompt suggestions');
    this.element.hidden = true;
    document.body.appendChild(this.element);

    document.addEventListener('input', this.onInput, true);
    document.addEventListener('keyup', this.onKeyUp, true);
    document.addEventListener('keydown', this.onKeyDown, true);
    document.addEventListener('mousedown', this.onOutsideMouseDown, true);
    window.addEventListener('scroll', this.onViewportChange, true);
    window.addEventListener('resize', this.onViewportChange);
    await this.refreshData();
    return true;
  }

  async refreshData() {
    try {
      const [prompts, folders] = await Promise.all([this.getPrompts(), this.getFolders()]);
      this.prompts = Array.isArray(prompts) ? prompts : [];
      this.folders = Array.isArray(folders) ? folders : [];
    } catch (error) {
      console.error('Failed to refresh slash-command prompts:', error);
    }
  }

  setPrompts(prompts) {
    this.prompts = Array.isArray(prompts) ? prompts : [];
    return this.getFolders().then((folders) => {
      this.folders = Array.isArray(folders) ? folders : [];
      if (this.context) this.renderMatches(this.context.query);
    });
  }

  isOpen() {
    return Boolean(this.element && !this.element.hidden);
  }

  getComposerCandidate(target) {
    if (!(target instanceof Element)) return null;
    return target.closest('textarea, input[type="text"], [contenteditable="true"]');
  }

  async refreshFromEvent(event) {
    const candidate = this.getComposerCandidate(event.target);
    if (!candidate) return;
    const inputBox = await this.getInputBox();
    if (!inputBox || (candidate !== inputBox && !inputBox.contains(candidate) && !candidate.contains(inputBox))) return;
    this.inputBox = inputBox;
    const context = this.readSlashContext(inputBox);
    if (!context) {
      this.close();
      return;
    }
    this.context = context;
    this.renderMatches(context.query);
  }

  readSlashContext(inputBox) {
    const tagName = inputBox.tagName?.toLowerCase();
    if (tagName === 'textarea' || tagName === 'input') {
      const caret = inputBox.selectionStart;
      if (caret == null) return null;
      const query = this.utils.getSlashCommandQuery(inputBox.value.slice(0, caret));
      if (query == null) return null;
      const start = caret - query.length - 1;
      if (inputBox.value.slice(start, caret).toLowerCase() !== `/${query}`) return null;
      return { query, range: { kind: 'text', start, end: caret } };
    }

    const selection = window.getSelection();
    if (!selection?.rangeCount || !selection.isCollapsed) return null;
    const anchor = selection.anchorNode;
    const offset = selection.anchorOffset;
    if (!anchor || anchor.nodeType !== Node.TEXT_NODE || !inputBox.contains(anchor)) return null;

    const beforeCaret = document.createRange();
    beforeCaret.selectNodeContents(inputBox);
    beforeCaret.setEnd(anchor, offset);
    const query = this.utils.getSlashCommandQuery(beforeCaret.toString());
    if (query == null) return null;
    const tokenLength = query.length + 1;
    if (anchor.textContent.slice(offset - tokenLength, offset).toLowerCase() !== `/${query}`) return null;

    const replacement = document.createRange();
    replacement.setStart(anchor, offset - tokenLength);
    replacement.setEnd(anchor, offset);
    return { query, range: { kind: 'range', value: replacement.cloneRange() } };
  }

  renderMatches(query) {
    this.matches = this.utils.filterPromptsForSlashCommand(this.prompts, this.folders, query).slice(0, 8);
    if (!this.matches.length) {
      this.close();
      return;
    }

    this.activeIndex = 0;
    this.element.replaceChildren();
    const heading = document.createElement('div');
    heading.className = 'pc-slash-picker-heading';
    heading.textContent = query ? `/${query}` : 'Prompt Copinier';
    this.element.appendChild(heading);

    this.matches.forEach((prompt, index) => {
      const option = document.createElement('button');
      option.type = 'button';
      option.className = 'pc-slash-picker-option';
      option.id = `prompt-copinier-slash-option-${index}`;
      option.setAttribute('role', 'option');
      option.setAttribute('aria-selected', String(index === this.activeIndex));
      const title = document.createElement('span');
      title.className = 'pc-slash-picker-title';
      title.textContent = prompt.title || 'Untitled prompt';
      const folder = this.folders.find((item) => item.id === prompt.folderId)?.name;
      const detail = document.createElement('span');
      detail.className = 'pc-slash-picker-detail';
      detail.textContent = [folder, ...(Array.isArray(prompt.tags) ? prompt.tags : [])].filter(Boolean).join(' · ');
      option.append(title, detail);
      option.addEventListener('mousedown', (event) => event.preventDefault());
      option.addEventListener('click', () => this.selectPrompt(prompt));
      this.element.appendChild(option);
    });

    this.element.hidden = false;
    if (!this.previousAriaAttributes && this.inputBox) {
      this.previousAriaAttributes = Object.fromEntries(
        ['aria-controls', 'aria-expanded', 'aria-activedescendant']
          .map((attribute) => [attribute, this.inputBox.getAttribute(attribute)]),
      );
    }
    this.inputBox?.setAttribute('aria-controls', this.element.id);
    this.inputBox?.setAttribute('aria-expanded', 'true');
    this.updateActiveOption();
    this.position();
  }

  updateActiveOption() {
    if (!this.element) return;
    const options = this.element.querySelectorAll('[role="option"]');
    options.forEach((option, index) => {
      const selected = index === this.activeIndex;
      option.setAttribute('aria-selected', String(selected));
      if (selected) {
        option.scrollIntoView({ block: 'nearest' });
        this.inputBox?.setAttribute('aria-activedescendant', option.id);
      }
    });
  }

  handleKeyDown(event) {
    if (!this.isOpen() || event.isComposing) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      event.stopImmediatePropagation();
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      this.activeIndex = (this.activeIndex + direction + this.matches.length) % this.matches.length;
      this.updateActiveOption();
      return;
    }
    if (event.key === 'Enter') {
      const prompt = this.matches[this.activeIndex];
      if (!prompt) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      this.selectPrompt(prompt);
      return;
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopImmediatePropagation();
      this.close();
    }
  }

  async selectPrompt(prompt) {
    const context = this.context;
    const inputBox = this.inputBox;
    this.close();
    if (!context || !inputBox?.isConnected) return;
    try {
      await this.onSelect(prompt, { inputBox, range: context.range });
    } catch (error) {
      console.error('Could not insert slash-command prompt:', error);
    }
  }

  position() {
    if (!this.isOpen() || !this.inputBox?.isConnected) return;
    const rect = this.inputBox.getBoundingClientRect();
    const width = Math.min(Math.max(rect.width, 280), window.innerWidth - 16);
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - width - 8));
    const height = Math.min(this.element.offsetHeight || 240, 320);
    const top = rect.top >= height + 16 ? rect.top - height - 8 : rect.bottom + 8;
    this.element.style.left = `${left}px`;
    this.element.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
    this.element.style.width = `${width}px`;
  }

  close() {
    if (!this.element) return;
    this.element.hidden = true;
    if (this.inputBox && this.previousAriaAttributes) {
      Object.entries(this.previousAriaAttributes).forEach(([attribute, value]) => {
        if (value == null) this.inputBox.removeAttribute(attribute);
        else this.inputBox.setAttribute(attribute, value);
      });
      this.previousAriaAttributes = null;
    }
    this.context = null;
  }
}

window.SlashCommandPicker = SlashCommandPicker;
