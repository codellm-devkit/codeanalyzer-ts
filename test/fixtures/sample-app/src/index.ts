import { UserController } from "./controllers";
import { Role } from "./models";
import { UserService } from "./services";
import { StringUtil } from "./util";

export function main(): void {
  const service = new UserService(100);
  service.create("Ada", Role.Admin);
  service.createGuest();

  const controller = new UserController(service);
  controller.list();
  controller.show("42");

  const slug = StringUtil.repeat("hello world", 2);
  const builder = new StringUtil.Builder();
  builder.add("a").add("b").build();
  console.log(slug);
}

main();
