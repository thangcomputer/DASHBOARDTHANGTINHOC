'use strict';
const Container = require('../Container');

describe('Container', () => {
  test('resolves singleton correctly', () => {
    const container = new Container();
    let instanceCount = 0;
    container.register('MyService', () => { instanceCount++; return { id: 1 }; });
    
    const s1 = container.resolve('MyService');
    const s2 = container.resolve('MyService');
    
    expect(instanceCount).toBe(1);
    expect(s1).toBe(s2);
  });
  
  test('throws if duplicate registration', () => {
    const container = new Container();
    container.register('A', () => ({}));
    expect(() => container.register('A', () => ({}))).toThrow();
  });
  
  test('throws if not found', () => {
    const container = new Container();
    expect(() => container.resolve('Unknown')).toThrow();
  });
});
