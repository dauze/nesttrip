import { DayScrollSyncConfig, DayScrollSyncService } from './day-scroll-sync.service';

describe('DayScrollSyncService', () => {
  let service: DayScrollSyncService;
  let frames: Map<number, FrameRequestCallback>;
  let nextFrame: number;
  let slide: HTMLElement;
  let active: boolean;

  function render(time: number): void {
    const pending = [...frames.values()];
    frames.clear();
    pending.forEach(callback => callback(time));
  }

  beforeEach(() => {
    frames = new Map();
    nextFrame = 0;
    active = true;
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      frames.set(++nextFrame, callback);
      return nextFrame;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => frames.delete(id));
    vi.spyOn(performance, 'now').mockReturnValue(0);
    slide = document.createElement('div');
    service = new DayScrollSyncService();
    service.connect({
      isActive: () => active,
      getSlideEl: () => slide,
      getFreshOffsets: () => [{ card: { activity: () => ({ id: 'target' }) }, top: 1000, height: 100 }],
      getDayMapPoints: () => [],
      getMapComponent: () => null,
      getStickyMapEl: () => null,
      isSplitLayout: () => true,
      getPinnedChromeOffset: () => 0,
      getLogisticOffsets: () => [],
    } as unknown as DayScrollSyncConfig);
  });

  afterEach(() => {
    service.ngOnDestroy();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it.each(['wheel', 'touchstart', 'pointerdown', 'keydown'])('lets %s interrupt without reopening an editor', (eventName) => {
    const complete = vi.fn();
    service.focusActivity('target', complete);
    render(200);
    const stoppedAt = slide.scrollTop;
    window.dispatchEvent(new Event(eventName));
    render(900);
    expect(slide.scrollTop).toBe(stoppedAt);
    expect(complete).not.toHaveBeenCalled();
  });

  it('cancels the previous target without completing its guided action', () => {
    const previousComplete = vi.fn();
    service.focusActivity('target', previousComplete);
    service.focusActivity('target');
    render(900);
    expect(previousComplete).not.toHaveBeenCalled();
  });

  it('cleans frames and input listeners synchronously on destruction', () => {
    const removeListener = vi.spyOn(window, 'removeEventListener');
    const complete = vi.fn();
    service.focusActivity('target', complete);
    service.ngOnDestroy();
    expect(frames.size).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    render(900);
    expect(complete).not.toHaveBeenCalled();
  });

  it('does not continue on an inactive day', () => {
    const complete = vi.fn();
    service.focusActivity('target', complete);
    active = false;
    render(900);
    expect(slide.scrollTop).toBe(0);
    expect(complete).not.toHaveBeenCalled();
  });

  it('completes a stable target once', () => {
    const complete = vi.fn();
    service.focusActivity('target', complete);
    for (let frame = 0; frame < 12; frame++) render(900 + frame * 16);
    expect(slide.scrollTop).toBe(992);
    expect(complete).toHaveBeenCalledTimes(1);
  });
});