import { TestBed } from '@angular/core/testing';
import { CanActivateFn } from '@angular/router';
import { unloggedGuard } from './unlogged-guard';
import { provideHttpClient } from '@angular/common/http';

describe('unloggedGuard', () => {
  const executeGuard: CanActivateFn = (...guardParameters) =>
    TestBed.runInInjectionContext(() => unloggedGuard(...guardParameters));

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient()],
    });
  });

  it('should be created', () => {
    expect(executeGuard).toBeTruthy();
  });
});
