import React, { useState, useEffect, useRef } from 'react';
import { useStickyBoard } from '../lib/StickyBoardContext';
import { Todo, Priority } from '../types';
import {
  Sparkles, Plus, ChevronLeft, ChevronRight, Search,
  Trash2, Copy, Pin, Star, Check,
  Sparkle, Loader2, ListChecks, LayoutGrid
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { offsetDateStr } from '../lib/dates';

export const DailyBoard: React.FC = () => {
  const {
    todos, currentDateStr, setCurrentDateStr, addTodo, updateTodo,
    deleteTodo, duplicateTodo, parseAIQuery, getAIBriefing, reorderTodos,
    user, getToday
  } = useStickyBoard();

  const defaultPriority = user?.preferences.defaultPriority ?? 'medium';
  const autoColorMode = user?.preferences.stickyColorMode === 'auto';

  // Container reference for boundary dragging
  const containerRef = useRef<HTMLDivElement>(null);

  // View mode: freeform corkboard dragging or sorted grid list
  const [boardViewMode, setBoardViewMode] = useState<'freeform' | 'grid'>(() => {
    try {
      return (localStorage.getItem('stickyboard_view_mode') as 'freeform' | 'grid') || 'freeform';
    } catch {
      return 'freeform';
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('stickyboard_view_mode', boardViewMode);
    } catch (e) {
      console.warn("Failed to save view mode to localStorage:", e);
    }
  }, [boardViewMode]);

  // Drag and Drop state
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [activePriority, setActivePriority] = useState<string>('all');

  // AI Briefing State — stamped with the date it was generated for, so
  // navigating to another day naturally hides it (no reset effect needed)
  const [aiBriefing, setAiBriefing] = useState<{ date: string; text: string } | null>(null);
  const [isBriefingLoading, setIsBriefingLoading] = useState(false);
  const briefingText = aiBriefing?.date === currentDateStr ? aiBriefing.text : null;

  // Natural Language Command Bar
  const [aiInput, setAiInput] = useState('');
  const [isAiParsing, setIsAiParsing] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Todo Form Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formTitle, setFormTitle] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formPriority, setFormPriority] = useState<Priority>(defaultPriority);
  const [formCategory, setFormCategory] = useState('Personal');
  const [formColor, setFormColor] = useState('yellow');
  const [formDueTime, setFormDueTime] = useState('');
  const [formEstimatedMinutes, setFormEstimatedMinutes] = useState('');
  const [formSubtasks, setFormSubtasks] = useState<string[]>([]);
  const [newSubtask, setNewSubtask] = useState('');

  // The command palette (and the `N` shortcut) opens the creation form
  // by dispatching this window event.
  useEffect(() => {
    const openForm = () => setIsFormOpen(true);
    window.addEventListener('sb:new-note', openForm);
    return () => window.removeEventListener('sb:new-note', openForm);
  }, []);

  // Editing state for Double Click
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState('');
  const [editingDesc, setEditingDesc] = useState('');

  // Confetti particles for complete animation (drift targets are rolled at
  // spawn time — render must stay pure)
  const [confetti, setConfetti] = useState<{ id: number; x: number; y: number; dx: number; dy: number; color: string }[]>([]);

  // Handle AI Parse
  const handleAiSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiInput.trim()) return;

    setIsAiParsing(true);
    setAiError(null);

    const res = await parseAIQuery(aiInput);
    if (res.success && res.todo) {
      // Structure the todo
      const parsed = res.todo;
      
      // Calculate due date based on parsed date offset
      let targetDateStr = currentDateStr;
      if (parsed.dateOffset && parsed.dateOffset > 0) {
        targetDateStr = offsetDateStr(getToday(), parsed.dateOffset);
      }

      await addTodo({
        title: parsed.title,
        description: parsed.description,
        priority: parsed.priority,
        category: parsed.category,
        dueTime: parsed.dueTime,
        noteColor: getColorFromPriority(parsed.priority),
        dateStr: targetDateStr,
        subtasks: []
      });
      setAiInput('');
    } else {
      setAiError(res.error || "Failed to process text. Try formatting simply.");
    }
    setIsAiParsing(false);
  };

  const getColorFromPriority = (p: string) => {
    if (p === 'critical') return 'pink';
    if (p === 'high') return 'orange';
    if (p === 'medium') return 'yellow';
    return 'green';
  };

  // Trigger Gemini Coach
  const triggerBriefing = async () => {
    setIsBriefingLoading(true);
    const text = await getAIBriefing('morning');
    setAiBriefing({ date: currentDateStr, text });
    setIsBriefingLoading(false);
  };

  // Navigation: offset day (local-timezone safe)
  const offsetDay = (days: number) => {
    setCurrentDateStr(offsetDateStr(currentDateStr, days));
  };

  const setToday = () => {
    setCurrentDateStr(getToday());
  };

  // Add subtask inside Creation Form
  const addFormSubtask = () => {
    if (!newSubtask.trim()) return;
    setFormSubtasks([...formSubtasks, newSubtask.trim()]);
    setNewSubtask('');
  };

  const removeFormSubtask = (idx: number) => {
    setFormSubtasks(formSubtasks.filter((_, i) => i !== idx));
  };

  // Submit manual creation form
  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) return;

    const success = await addTodo({
      title: formTitle.trim(),
      description: formDesc.trim(),
      priority: formPriority,
      category: formCategory,
      noteColor: autoColorMode ? undefined : formColor,
      dueTime: formDueTime || undefined,
      estimatedMinutes: formEstimatedMinutes ? Number(formEstimatedMinutes) : undefined,
      subtasks: formSubtasks.map(t => ({ title: t, isCompleted: false }))
    });

    if (success) {
      setIsFormOpen(false);
      setFormTitle('');
      setFormDesc('');
      setFormPriority(defaultPriority);
      setFormColor('yellow');
      setFormCategory('Personal');
      setFormDueTime('');
      setFormEstimatedMinutes('');
      setFormSubtasks([]);
    }
  };

  // Complete Animation: Confetti particle spawner
  const handleCompleteClick = async (todo: Todo, e: React.MouseEvent) => {
    const isNowCompleted = !todo.isCompleted;
    
    if (isNowCompleted) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const x = rect.left + rect.width / 2;
      const y = rect.top + rect.height / 2;

      const particleColors = ['#f43f5e', '#3b82f6', '#10b981', '#fbbf24', '#a78bfa', '#ff7849'];
      const newConfetti = Array.from({ length: 20 }).map((_, i) => ({
        id: Date.now() + i,
        x,
        y,
        dx: Math.random() * 120 - 60,
        dy: Math.random() * 120 - 60,
        color: particleColors[Math.floor(Math.random() * particleColors.length)]
      }));

      setConfetti(prev => [...prev, ...newConfetti]);
      setTimeout(() => {
        setConfetti(prev => prev.filter(c => !newConfetti.find(nc => nc.id === c.id)));
      }, 1000);
    }

    await updateTodo(todo.id, { isCompleted: isNowCompleted });
  };

  // Double Click Editor Activator
  const startEditing = (todo: Todo) => {
    setEditingTodoId(todo.id);
    setEditingTitle(todo.title);
    setEditingDesc(todo.description || '');
  };

  const saveInlineEdit = async (id: string) => {
    if (!editingTitle.trim()) return;
    await updateTodo(id, { title: editingTitle.trim(), description: editingDesc.trim() });
    setEditingTodoId(null);
  };

  // Category filter presets
  const categories = ['all', 'Personal', 'Work', 'Health', 'Finance', 'Urgent'];

  // Hashing to generate slightly different deterministic rotations per note id
  const getRotationAngle = (id: string) => {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    return (hash % 5) * 0.7; // rotation between -2.8 and 2.8 degrees
  };

  // Filtered list
  const filteredTodos = todos.filter(t => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesCategory = activeCategory === 'all' || t.category === activeCategory;
    const matchesPriority = activePriority === 'all' || t.priority === activePriority;
    return matchesSearch && matchesCategory && matchesPriority;
  });

  // Drag-and-drop hit detection & reordering
  const handleDrag = (id: string, info: any) => {
    const element = document.elementFromPoint(info.point.x, info.point.y);
    if (!element) return;

    const card = element.closest('[data-todo-id]');
    if (!card) return;

    const targetId = card.getAttribute('data-todo-id');
    if (targetId && targetId !== id) {
      const draggedIndex = filteredTodos.findIndex(t => t.id === id);
      const targetIndex = filteredTodos.findIndex(t => t.id === targetId);

      if (draggedIndex !== -1 && targetIndex !== -1) {
        const newFiltered = [...filteredTodos];
        const [removed] = newFiltered.splice(draggedIndex, 1);
        newFiltered.splice(targetIndex, 0, removed);

        // Map todos to construct complete new ordered list
        const filteredIdsSet = new Set(filteredTodos.map(t => t.id));
        const orderedIds: string[] = [];
        let filteredIdx = 0;

        todos.forEach(todo => {
          if (filteredIdsSet.has(todo.id)) {
            orderedIds.push(newFiltered[filteredIdx++].id);
          } else {
            orderedIds.push(todo.id);
          }
        });

        if (reorderTodos) {
          reorderTodos(orderedIds);
        }
      }
    }
  };

  // Dynamic freeform layout positioning logic
  const getTodoCoordinates = (todo: Todo, index: number) => {
    if (todo.positionX !== undefined && todo.positionY !== undefined) {
      return { x: todo.positionX, y: todo.positionY };
    }
    
    // Fallback: build a dynamic grid initially
    const cols = 3;
    const cardWidth = 270;
    const cardHeight = 310;
    const paddingX = 40;
    const paddingY = 40;
    
    const colIndex = index % cols;
    const rowIndex = Math.floor(index / cols);
    
    return {
      x: colIndex * cardWidth + paddingX,
      y: rowIndex * cardHeight + paddingY
    };
  };

  // Drag-and-drop end handler for freeform boards
  const handleFreeformDragEnd = (todo: Todo, event: any) => {
    setDraggedId(null);
    if (!containerRef.current) return;
    
    const containerRect = containerRef.current.getBoundingClientRect();
    const cardElement = event.target.closest('[data-todo-id]');
    if (!cardElement) return;

    const cardRect = cardElement.getBoundingClientRect();
    const relativeX = cardRect.left - containerRect.left + containerRef.current.scrollLeft;
    const relativeY = cardRect.top - containerRect.top + containerRef.current.scrollTop;

    // Constrain within a reasonable canvas boundary
    const maxX = Math.max(containerRect.width - 256, 1200);
    const maxY = Math.max(containerRect.height - 300, 800);
    const boundedX = Math.max(16, Math.min(relativeX, maxX));
    const boundedY = Math.max(16, Math.min(relativeY, maxY));

    // Save position to database via context
    updateTodo(todo.id, { positionX: boundedX, positionY: boundedY });
  };

  // Align sticky notes into a perfect grid layout in freeform space
  const organizeBoardGrid = () => {
    const cols = 3;
    const cardWidth = 270;
    const cardHeight = 310;
    const paddingX = 40;
    const paddingY = 40;

    filteredTodos.forEach((todo, index) => {
      const colIndex = index % cols;
      const rowIndex = Math.floor(index / cols);
      const targetX = colIndex * cardWidth + paddingX;
      const targetY = rowIndex * cardHeight + paddingY;

      updateTodo(todo.id, { positionX: targetX, positionY: targetY });
    });
  };

  // Calculate dynamic board height for freeform mode
  let maxCalculatedHeight = 550;
  if (boardViewMode === 'freeform') {
    filteredTodos.forEach((todo, idx) => {
      const coords = getTodoCoordinates(todo, idx);
      if (coords.y + 350 > maxCalculatedHeight) {
        maxCalculatedHeight = coords.y + 350;
      }
    });
  }

  return (
    <div className="min-h-screen px-4 py-6 md:pl-72 md:pr-8 md:py-8 pb-24 md:pb-8">
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-line pb-6">
        <div>
          <span className="text-[10px] uppercase font-mono tracking-wider text-accent-soft">Workspace Canvas</span>
          <h1 className="font-display text-3xl font-extrabold text-ink tracking-tight">Today's Board</h1>
        </div>

        {/* Tactical Date Navigator */}
        <div className="flex items-center gap-1.5 rounded-xl border border-line bg-surface p-1.5">
          <button 
            onClick={() => offsetDay(-1)} 
            className="rounded-lg p-2 text-ink-soft hover:bg-raise hover:text-ink"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <span className="font-display text-xs font-semibold text-ink px-3">
            {new Date(`${currentDateStr}T00:00:00`).toLocaleDateString('en-US', {
              weekday: 'short', month: 'short', day: 'numeric', year: 'numeric'
            })}
          </span>

          <button 
            onClick={() => offsetDay(1)} 
            className="rounded-lg p-2 text-ink-soft hover:bg-raise hover:text-ink"
          >
            <ChevronRight className="h-4 w-4" />
          </button>

          <div className="h-4 w-px bg-raise-strong mx-1" />

          <button 
            onClick={setToday}
            className="rounded-lg bg-muted border border-line px-2.5 py-1 text-[10px] font-bold text-accent-soft hover:bg-muted-strong"
          >
            Today
          </button>
        </div>
      </div>

      {/* AI ASSISTANCE BOARD & NATURAL LANGUAGE BOX */}
      <div className="mt-6 grid gap-6 md:grid-cols-12">
        {/* Smart input bar */}
        <div className="md:col-span-7 flex flex-col gap-4">
          <form onSubmit={handleAiSubmit} className="relative group">
            <div className="absolute inset-0 -m-0.5 rounded-2xl bg-gradient-to-r from-accent to-accent-strong opacity-0 group-focus-within:opacity-20 blur transition-opacity" />
            <div className="relative flex items-center gap-2 rounded-2xl border border-line-strong bg-panel p-2">
              <Sparkles className="h-5 w-5 text-accent-soft ml-3 flex-shrink-0" />
              <input 
                type="text"
                value={aiInput}
                onChange={(e) => setAiInput(e.target.value)}
                placeholder="Type naturally: 'Review design tomorrow at 2pm high priority'..."
                className="flex-1 bg-transparent px-2 py-2 text-sm text-ink placeholder-zinc-500 outline-none"
                disabled={isAiParsing}
              />
              <button 
                type="submit"
                disabled={isAiParsing}
                className="rounded-xl bg-gradient-to-r from-accent to-accent-strong px-4 py-2 font-display text-xs font-bold text-white shadow shadow-accent/20 hover:brightness-115 disabled:opacity-50"
              >
                {isAiParsing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Pin with AI'}
              </button>
            </div>
          </form>
          {aiError && (
            <span className="text-[10px] font-medium text-rose-400 pl-4">⚠️ {aiError}</span>
          )}
        </div>

        {/* Mini Daily Coaching widget */}
        <div className="md:col-span-5">
          <div className="rounded-2xl border border-line bg-muted/10 p-4">
            <AnimatePresence mode="wait">
              {!briefingText ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-accent-soft">
                      <Sparkle className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="font-display text-xs font-bold text-ink">Daily Coach Insights</h4>
                      <p className="text-[10px] text-ink-faint">Analyze today's board with Gemini</p>
                    </div>
                  </div>
                  <button 
                    onClick={triggerBriefing}
                    disabled={isBriefingLoading}
                    className="rounded-lg border border-accent/20 bg-accent/5 px-3 py-1.5 font-display text-[10px] font-bold text-accent-soft hover:bg-accent/10"
                  >
                    {isBriefingLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : 'Coach Briefing'}
                  </button>
                </div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="relative rounded-xl border border-accent/15 bg-accent/5 p-3 text-xs leading-relaxed text-ink-soft"
                >
                  <p>{briefingText}</p>
                  <button 
                    onClick={() => setAiBriefing(null)}
                    className="absolute top-1.5 right-1.5 text-[9px] text-ink-faint hover:text-ink-soft font-semibold uppercase"
                  >
                    Clear
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      {/* FILTER BAR & ADD TASK TRIGGER */}
      <div className="mt-8 flex flex-col md:flex-row md:items-center justify-between gap-4 border-t border-line pt-6">
        {/* Search */}
        <div className="relative max-w-xs flex-1">
          <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-ink-faint" />
          <input 
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search sticky board..."
            className="w-full rounded-xl border border-line bg-surface py-2 pr-4 pl-9 text-xs text-ink placeholder-zinc-500 outline-none focus:border-accent"
          />
        </div>

        {/* Filter categories tags + priority filter */}
        <div className="flex flex-wrap items-center gap-1.5">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`rounded-lg px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider transition-all ${
                activeCategory === cat
                  ? 'bg-accent text-white shadow shadow-accent/20'
                  : 'border border-line bg-field text-ink-faint hover:text-ink-soft'
              }`}
            >
              {cat}
            </button>
          ))}

          <select
            value={activePriority}
            onChange={(e) => setActivePriority(e.target.value)}
            title="Filter by priority"
            className={`rounded-lg border px-2 py-1.5 text-[10px] font-bold uppercase tracking-wider outline-none transition-all ${
              activePriority !== 'all'
                ? 'border-accent bg-accent/10 text-accent-soft'
                : 'border-line bg-field text-ink-faint'
            }`}
          >
            <option value="all">Priority: All</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="critical">Critical</option>
          </select>
        </div>

        {/* Actions bar including layout toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Layout Mode Selector */}
          <div className="flex items-center rounded-xl bg-field border border-line p-1">
            <button
              onClick={() => setBoardViewMode('freeform')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                boardViewMode === 'freeform'
                  ? 'bg-accent text-white shadow'
                  : 'text-ink-faint hover:text-ink-soft'
              }`}
              title="Freeform Drag & Drop Workspace"
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              <span>Freeform</span>
            </button>
            <button
              onClick={() => setBoardViewMode('grid')}
              className={`flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all ${
                boardViewMode === 'grid'
                  ? 'bg-accent text-white shadow'
                  : 'text-ink-faint hover:text-ink-soft'
              }`}
              title="Automated Sorted Grid"
            >
              <ListChecks className="h-3.5 w-3.5" />
              <span>Grid</span>
            </button>
          </div>

          {/* Quick Organize Button (Only visible in freeform) */}
          {boardViewMode === 'freeform' && filteredTodos.length > 0 && (
            <button
              onClick={organizeBoardGrid}
              className="flex items-center gap-1.5 rounded-xl border border-line bg-muted px-3.5 py-2 text-[9px] font-bold text-accent-soft hover:bg-muted-strong transition-all uppercase tracking-wider"
              title="Align notes back into a beautiful clean grid"
            >
              <Sparkle className="h-3.5 w-3.5" />
              <span>Snap Grid</span>
            </button>
          )}

          {/* Manual Sticky creation button */}
          <button 
            onClick={() => setIsFormOpen(true)}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-accent px-4 py-2 font-display text-xs font-bold text-white shadow-lg shadow-accent/15 hover:bg-accent-strong"
          >
            <Plus className="h-4 w-4" />
            <span>New Note</span>
          </button>
        </div>
      </div>

      {/* CORKBOARD CONTAINER */}
      <div 
        ref={containerRef}
        className={`corkboard-grid mt-6 rounded-2xl border border-line-strong p-8 relative overflow-auto ${
          boardViewMode === 'freeform' ? 'min-h-[640px]' : 'min-h-[480px] flex flex-wrap justify-center sm:justify-start items-start gap-8'
        }`}
        style={boardViewMode === 'freeform' ? { height: `${maxCalculatedHeight}px` } : undefined}
      >
        <div className="absolute inset-0 gradient-glow pointer-events-none" />

        <AnimatePresence>
          {filteredTodos.map((todo, index) => {
            const rotAngle = getRotationAngle(todo.id);
            const isCompleted = todo.isCompleted;
            const isEditing = editingTodoId === todo.id;
            const colorClass = `sticky-${todo.noteColor}`;

            // Priority tags
            const priorityColors = {
              low: 'bg-field/20 text-current border border-current/10',
              medium: 'bg-amber-950/20 text-amber-900 border border-amber-900/10',
              high: 'bg-orange-950/20 text-orange-900 border border-orange-900/10',
              critical: 'bg-rose-950/20 text-rose-900 border border-rose-900/10'
            };

            const coords = getTodoCoordinates(todo, index);
            const isFreeform = boardViewMode === 'freeform';

            return (
              <motion.div
                key={todo.id}
                layout={!isFreeform}
                initial={
                  isFreeform 
                    ? { x: coords.x, y: coords.y, scale: 0.8, opacity: 0 }
                    : { scale: 0.8, opacity: 0, rotate: rotAngle * 1.5 }
                }
                animate={
                  isFreeform
                    ? { 
                        x: coords.x,
                        y: coords.y,
                        scale: isCompleted ? 0.95 : 1, 
                        opacity: isCompleted ? 0.75 : 1, 
                        rotate: isEditing ? 0 : rotAngle 
                      }
                    : { 
                        scale: isCompleted ? 0.95 : 1, 
                        opacity: isCompleted ? 0.75 : 1, 
                        rotate: isEditing ? 0 : rotAngle 
                      }
                }
                exit={{ scale: 0.8, opacity: 0 }}
                style={
                  isFreeform
                    ? { transformOrigin: 'top center', position: 'absolute', left: 0, top: 0 }
                    : { transformOrigin: 'top center' }
                }
                onDoubleClick={() => !isCompleted && startEditing(todo)}
                drag={!isEditing && !isCompleted}
                dragConstraints={isFreeform ? containerRef : { left: 0, right: 0, top: 0, bottom: 0 }}
                dragElastic={isFreeform ? 0 : 1}
                dragMomentum={!isFreeform}
                dragTransition={isFreeform ? undefined : { bounceStiffness: 400, bounceDamping: 25 }}
                onDragStart={() => setDraggedId(todo.id)}
                onDrag={isFreeform ? undefined : (_e, info) => handleDrag(todo.id, info)}
                onDragEnd={isFreeform ? (e) => handleFreeformDragEnd(todo, e) : () => setDraggedId(null)}
                whileDrag={{ scale: 1.05, rotate: 0, zIndex: 50 }}
                data-todo-id={todo.id}
                className={`folded-corner group relative w-64 p-5 shadow-sticky hover:shadow-sticky-hover cursor-grab ${
                  draggedId === todo.id 
                    ? 'z-50 cursor-grabbing shadow-2xl scale-105' 
                    : 'transition-all duration-300'
                } ${colorClass}`}
              >
                {/* Push Pin Header */}
                <div className={`absolute top-2.5 left-1/2 z-20 h-4 w-4 -translate-x-1/2 transition-transform duration-300 group-hover:-translate-y-0.5 ${
                  isCompleted ? 'animate-pin-pop opacity-0' : 'animate-pin-drop'
                }`}>
                  <div className="absolute top-0 left-1/2 h-3.5 w-3.5 -translate-x-1/2 rounded-full shadow-md" style={{ 
                    backgroundColor: todo.noteColor === 'pink' ? '#ec4899' : 
                                    todo.noteColor === 'mint' ? '#14b8a6' : 
                                    todo.noteColor === 'blue' ? '#3b82f6' : 
                                    todo.noteColor === 'green' ? '#10b981' : 
                                    todo.noteColor === 'purple' ? '#a78bfa' : '#fbbf24' 
                  }} />
                  <div className="mx-auto mt-2.5 h-3 w-0.5 bg-zinc-400" />
                </div>

                {/* Corner Fold style */}
                <div className="corner-fold" />

                {/* Double Click Edit Body */}
                {isEditing ? (
                  <div className="space-y-3 mt-2">
                    <input 
                      type="text"
                      value={editingTitle}
                      onChange={(e) => setEditingTitle(e.target.value)}
                      className="w-full border-b border-black/10 bg-transparent py-1 font-handwritten text-lg font-bold text-inherit outline-none"
                    />
                    <textarea 
                      value={editingDesc}
                      onChange={(e) => setEditingDesc(e.target.value)}
                      rows={2}
                      className="w-full bg-transparent py-1 font-handwritten text-sm text-inherit outline-none resize-none"
                    />
                    <div className="flex justify-end gap-1.5 pt-1">
                      <button 
                        onClick={() => setEditingTodoId(null)}
                        className="rounded bg-black/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                      >
                        Cancel
                      </button>
                      <button 
                        onClick={() => saveInlineEdit(todo.id)}
                        className="rounded bg-black/15 px-2 py-1 text-[10px] font-bold uppercase tracking-wider"
                      >
                        Save
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col h-full mt-2">
                    {/* Header line info */}
                    <div className="flex items-center justify-between mb-2">
                      <span className={`rounded px-1.5 py-0.5 text-[8px] font-extrabold uppercase ${priorityColors[todo.priority]}`}>
                        {todo.priority}
                      </span>
                      <span className="flex items-center gap-1">
                        {todo.dueTime && (
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-black/5 px-1 rounded">
                            ⏰ {todo.dueTime}
                          </span>
                        )}
                        {todo.estimatedMinutes !== undefined && todo.estimatedMinutes > 0 && (
                          <span className="font-mono text-[9px] font-bold uppercase tracking-wider bg-black/5 px-1 rounded">
                            ⏳ {todo.estimatedMinutes >= 60 ? `${Math.round((todo.estimatedMinutes / 60) * 10) / 10}h` : `${todo.estimatedMinutes}m`}
                          </span>
                        )}
                      </span>
                    </div>

                    {/* Todo Main Content */}
                    <div className="flex items-start gap-2.5 mt-1">
                      <button 
                        onClick={(e) => handleCompleteClick(todo, e)}
                        className={`mt-1 flex h-4.5 w-4.5 flex-shrink-0 items-center justify-center rounded border border-current transition-all ${
                          isCompleted ? 'bg-current' : 'hover:bg-black/5'
                        }`}
                      >
                        {isCompleted && <Check className="h-3 w-3 text-zinc-900 stroke-[3]" />}
                      </button>

                      <div className="flex-1 min-w-0">
                        <p className={`font-handwritten text-lg font-semibold leading-tight break-words ${isCompleted ? 'line-through opacity-55 decoration-2' : ''}`}>
                          {todo.title}
                        </p>
                        {todo.description && (
                          <p className={`font-handwritten text-xs leading-normal mt-1 opacity-85 break-words ${isCompleted ? 'line-through opacity-40' : ''}`}>
                            {todo.description}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Subtasks Summary */}
                    {todo.subtasks.length > 0 && (
                      <div className="mt-4 border-t border-black/5 pt-2 space-y-1">
                        <div className="flex items-center gap-1 text-[9px] font-bold uppercase opacity-60">
                          <ListChecks className="h-3 w-3" />
                          <span>Subtasks</span>
                        </div>
                        {todo.subtasks.map((st) => (
                          <div 
                            key={st.id} 
                            onClick={async () => {
                              const updatedSub = todo.subtasks.map(s => s.id === st.id ? { ...s, isCompleted: !s.isCompleted } : s);
                              await updateTodo(todo.id, { subtasks: updatedSub });
                            }}
                            className="flex items-center gap-2 cursor-pointer group/sub"
                          >
                            <div className={`h-3 w-3 rounded border border-current flex items-center justify-center ${st.isCompleted ? 'bg-current' : 'hover:bg-black/5'}`}>
                              {st.isCompleted && <Check className="h-2.5 w-2.5 text-zinc-900 stroke-[4]" />}
                            </div>
                            <span className={`font-handwritten text-xs leading-none ${st.isCompleted ? 'line-through opacity-50' : ''}`}>
                              {st.title}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Custom hover quick action board footer */}
                    <div className="mt-5 flex items-center justify-between border-t border-black/5 pt-2 text-[9px] opacity-75">
                      <span className="font-mono uppercase tracking-wider text-[8px] opacity-60">
                        {todo.category}
                      </span>

                      {/* Tool overlay */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button 
                          onClick={() => updateTodo(todo.id, { isFavorite: !todo.isFavorite })}
                          className={`rounded p-1 hover:bg-black/5 ${todo.isFavorite ? 'text-amber-500' : ''}`}
                        >
                          <Star className="h-3 w-3 fill-current" />
                        </button>
                        <button 
                          onClick={() => updateTodo(todo.id, { isPinned: !todo.isPinned })}
                          className={`rounded p-1 hover:bg-black/5 ${todo.isPinned ? 'text-blue-500' : ''}`}
                        >
                          <Pin className="h-3 w-3 fill-current" />
                        </button>
                        <button 
                          onClick={() => duplicateTodo(todo.id)}
                          className="rounded p-1 hover:bg-black/5"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                        <button 
                          onClick={() => deleteTodo(todo.id)}
                          className="rounded p-1 hover:bg-black/5 hover:text-rose-600"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Empty state corkboard */}
        {filteredTodos.length === 0 && (
          <div className="flex flex-col items-center justify-center w-full py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-raise-faint border border-line text-ink-faint mb-4">
              <Plus className="h-6 w-6" />
            </div>
            <h4 className="font-display text-sm font-bold text-ink">Empty Corkboard</h4>
            <p className="text-xs text-ink-faint max-w-xs mt-1">
              Create a sticky note above, or type some natural language prompt to let AI schedule.
            </p>
          </div>
        )}
      </div>

      {/* CONFETTI SVG PARTICLE OVERLAY */}
      {confetti.map((c) => (
        <motion.div
          key={c.id}
          initial={{ x: c.x, y: c.y, scale: 1, opacity: 1 }}
          animate={{
            y: c.y + c.dy,
            x: c.x + c.dx,
            scale: 0.1,
            opacity: 0
          }}
          transition={{ duration: 1 }}
          className="fixed z-50 h-2 w-2 rounded-full pointer-events-none"
          style={{ backgroundColor: c.color }}
        />
      ))}

      {/* CREATION FORM DIALOG MODAL */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setIsFormOpen(false)} />
          <motion.div 
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="relative w-full max-w-md rounded-2xl border border-line-strong bg-panel p-6 shadow-2xl z-10"
          >
            <h3 className="font-display text-lg font-bold text-ink mb-4">New Sticky Note</h3>

            <form onSubmit={handleFormSubmit} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Note Title</label>
                <input 
                  type="text" 
                  required
                  value={formTitle}
                  onChange={(e) => setFormTitle(e.target.value)}
                  placeholder="Task title..."
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink outline-none focus:border-accent"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Description</label>
                <textarea 
                  value={formDesc}
                  onChange={(e) => setFormDesc(e.target.value)}
                  placeholder="Extra details..."
                  rows={2}
                  className="w-full rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink outline-none focus:border-accent resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Priority</label>
                  <select 
                    value={formPriority}
                    onChange={(e) => setFormPriority(e.target.value as Priority)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-accent"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Category</label>
                  <select 
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-3.5 py-2 text-xs text-ink outline-none focus:border-accent"
                  >
                    <option value="Personal">Personal</option>
                    <option value="Work">Work</option>
                    <option value="Health">Health</option>
                    <option value="Finance">Finance</option>
                    <option value="Urgent">Urgent</option>
                  </select>
                </div>
              </div>

              {/* Due time & estimated duration */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Due Time (Optional)</label>
                  <input
                    type="time"
                    value={formDueTime}
                    onChange={(e) => setFormDueTime(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Est. Minutes (Optional)</label>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    placeholder="e.g. 30"
                    value={formEstimatedMinutes}
                    onChange={(e) => setFormEstimatedMinutes(e.target.value)}
                    className="w-full rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                </div>
              </div>

              {/* Paper color presets selector (hidden when colors are auto-assigned) */}
              {autoColorMode ? (
                <p className="text-[10px] text-ink-faint">
                  Paper color is auto-assigned from priority. Switch to manual colors in Settings → Board Behavior.
                </p>
              ) : (
                <div className="space-y-1">
                  <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Sticky Color Theme</label>
                  <div className="flex gap-2 pt-1">
                    {['yellow', 'blue', 'green', 'pink', 'purple', 'orange', 'mint', 'cream'].map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setFormColor(color)}
                        className={`h-5 w-5 rounded-full border ${
                          formColor === color ? 'ring-2 ring-accent border-white' : 'border-line-strong'
                        }`}
                        style={{
                          backgroundColor: color === 'yellow' ? '#fde047' :
                                          color === 'blue' ? '#93c5fd' :
                                          color === 'green' ? '#86efac' :
                                          color === 'pink' ? '#f9a8d4' :
                                          color === 'purple' ? '#d8b4fe' :
                                          color === 'orange' ? '#fdba74' :
                                          color === 'mint' ? '#99f6e4' : '#fafaf9'
                        }}
                      />
                    ))}
                  </div>
                </div>
              )}

              {/* Subtasks form builder */}
              <div className="space-y-1">
                <label className="text-[10px] uppercase tracking-wider font-mono text-ink-faint">Subtasks</label>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newSubtask}
                    onChange={(e) => setNewSubtask(e.target.value)}
                    placeholder="Subtask name..."
                    className="flex-1 rounded-xl border border-line bg-surface px-4 py-2 text-xs text-ink outline-none focus:border-accent"
                  />
                  <button 
                    type="button" 
                    onClick={addFormSubtask}
                    className="rounded-xl border border-line bg-muted-strong px-3 py-2 text-xs text-ink-soft hover:text-ink"
                  >
                    Add
                  </button>
                </div>
                {formSubtasks.length > 0 && (
                  <div className="mt-2 space-y-1 max-h-24 overflow-y-auto">
                    {formSubtasks.map((st, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded bg-surface px-2 py-1 text-xs">
                        <span className="text-ink-soft">{st}</span>
                        <button 
                           type="button" 
                          onClick={() => removeFormSubtask(idx)}
                          className="text-rose-500 text-[10px]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex justify-end gap-2 pt-4">
                <button 
                  type="button" 
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-line bg-muted px-4 py-2.5 font-display text-xs text-ink-soft hover:text-ink"
                >
                  Discard
                </button>
                <button 
                  type="submit"
                  className="rounded-xl bg-accent px-4 py-2.5 font-display text-xs font-bold text-white hover:bg-accent-strong"
                >
                  Pin to Board
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </div>
  );
};
