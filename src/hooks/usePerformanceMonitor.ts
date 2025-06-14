import { useRef, useEffect, useCallback, useMemo } from 'react';
import { cacheUtils } from '../services/cacheManager';

interface PerformanceMetrics {
  renderCount: number;
  lastRenderTime: number;
  averageRenderTime: number;
  slowRenders: number;
  cacheHitRate: number;
  memoryUsage: string;
}

interface UsePerformanceMonitorOptions {
  name: string;
  slowRenderThreshold?: number;
  enableLogging?: boolean;
  trackCacheStats?: boolean;
}

export const usePerformanceMonitor = (options: UsePerformanceMonitorOptions) => {
  const {
    name,
    slowRenderThreshold = 16, // 16ms for 60fps
    enableLogging = import.meta.env.DEV,
    trackCacheStats = true
  } = options;

  const metricsRef = useRef({
    renderCount: 0,
    renderTimes: [] as number[],
    slowRenders: 0,
    startTime: 0
  });

  const startTimeRef = useRef<number>(0);

  // Start performance measurement
  const startMeasurement = useCallback(() => {
    startTimeRef.current = performance.now();
  }, []);

  // End performance measurement
  const endMeasurement = useCallback(() => {
    const endTime = performance.now();
    const renderTime = endTime - startTimeRef.current;
    
    const metrics = metricsRef.current;
    metrics.renderCount++;
    metrics.renderTimes.push(renderTime);
    
    // Keep only last 100 render times for average calculation
    if (metrics.renderTimes.length > 100) {
      metrics.renderTimes.shift();
    }
    
    // Track slow renders
    if (renderTime > slowRenderThreshold) {
      metrics.slowRenders++;
      
      if (enableLogging) {
        console.warn(`[Performance] Slow render in ${name}: ${renderTime.toFixed(2)}ms`);
      }
    }
    
    return renderTime;
  }, [name, slowRenderThreshold, enableLogging]);

  // Calculate performance metrics
  const getMetrics = useCallback((): PerformanceMetrics => {
    const metrics = metricsRef.current;
    const averageRenderTime = metrics.renderTimes.length > 0
      ? metrics.renderTimes.reduce((sum, time) => sum + time, 0) / metrics.renderTimes.length
      : 0;

    let cacheStats = { hitRate: 0, memoryUsage: '0KB' };
    if (trackCacheStats) {
      const allStats = cacheUtils.getAllStats();
      const totalHits = Object.values(allStats).reduce((sum, stat) => sum + stat.hitRate, 0);
      cacheStats = {
        hitRate: totalHits / Object.keys(allStats).length,
        memoryUsage: Object.values(allStats)
          .map(stat => stat.memoryUsage)
          .join(', ')
      };
    }

    return {
      renderCount: metrics.renderCount,
      lastRenderTime: metrics.renderTimes[metrics.renderTimes.length - 1] || 0,
      averageRenderTime,
      slowRenders: metrics.slowRenders,
      cacheHitRate: cacheStats.hitRate,
      memoryUsage: cacheStats.memoryUsage
    };
  }, [trackCacheStats]);

  // Log performance summary
  const logSummary = useCallback(() => {
    if (!enableLogging) return;
    
    const metrics = getMetrics();
    console.group(`[Performance Summary] ${name}`);
    console.log(`Renders: ${metrics.renderCount}`);
    console.log(`Average render time: ${metrics.averageRenderTime.toFixed(2)}ms`);
    console.log(`Slow renders: ${metrics.slowRenders} (${((metrics.slowRenders / metrics.renderCount) * 100).toFixed(1)}%)`);
    if (trackCacheStats) {
      console.log(`Cache hit rate: ${(metrics.cacheHitRate * 100).toFixed(1)}%`);
      console.log(`Memory usage: ${metrics.memoryUsage}`);
    }
    console.groupEnd();
  }, [name, enableLogging, getMetrics, trackCacheStats]);

  // Reset metrics
  const resetMetrics = useCallback(() => {
    metricsRef.current = {
      renderCount: 0,
      renderTimes: [],
      slowRenders: 0,
      startTime: 0
    };
  }, []);

  // Track render start
  useEffect(() => {
    startMeasurement();
  });

  // Track render end
  useEffect(() => {
    endMeasurement();
  });

  // Cleanup and log summary on unmount
  useEffect(() => {
    return () => {
      logSummary();
    };
  }, [logSummary]);

  // Memoized return object
  return useMemo(() => ({
    getMetrics,
    logSummary,
    resetMetrics,
    startMeasurement,
    endMeasurement
  }), [getMetrics, logSummary, resetMetrics, startMeasurement, endMeasurement]);
};

// Hook for tracking dependency changes
export const useDependencyTracker = (dependencies: any[], name: string) => {
  const prevDepsRef = useRef<any[]>();
  const changeCountRef = useRef(0);

  useEffect(() => {
    if (prevDepsRef.current) {
      const changedDeps = dependencies.map((dep, index) => {
        const changed = dep !== prevDepsRef.current![index];
        return { index, changed, prev: prevDepsRef.current![index], current: dep };
      }).filter(dep => dep.changed);

      if (changedDeps.length > 0) {
        changeCountRef.current++;
        
        if (import.meta.env.DEV) {
          console.group(`[Dependency Change] ${name} - Change #${changeCountRef.current}`);
          changedDeps.forEach(({ index, prev, current }) => {
            console.log(`Dependency ${index}:`, { prev, current });
          });
          console.groupEnd();
        }
      }
    }
    
    prevDepsRef.current = [...dependencies];
  });

  return changeCountRef.current;
};

// Hook for measuring component mount time
export const useMountTime = (componentName: string) => {
  const mountStartRef = useRef<number>(performance.now());

  useEffect(() => {
    const mountTime = performance.now() - mountStartRef.current;
    
    if (import.meta.env.DEV) {
      console.log(`[Mount Time] ${componentName}: ${mountTime.toFixed(2)}ms`);
    }
  }, [componentName]);
};

export default usePerformanceMonitor; 