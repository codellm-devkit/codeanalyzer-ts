import { Role, User, type UserId } from "./models";

/** Pure helper — top-level function. */
export function makeGuestName(seed: number): string {
  return `guest-${seed}`;
}

/** Arrow function bound to a const (function_expression-style callable). */
export const nextId = (n: number): UserId => n + 1;

export class UserService {
  private users: User[] = [];

  constructor(private readonly startId: number = 0) {}

  create(name: string, role: Role = Role.Member): User {
    const id = nextId(this.users.length + this.startId);
    const user = new User(id, name, role);
    this.users.push(user);
    return user;
  }

  createGuest(): User {
    const name = makeGuestName(this.users.length);
    return this.create(name, Role.Guest);
  }

  describeAll(): string[] {
    return this.users.map((u) => u.describe());
  }

  async loginAll(): Promise<number> {
    let total = 0;
    for (const u of this.users) {
      total += await u.recordLogin();
    }
    return total;
  }
}
