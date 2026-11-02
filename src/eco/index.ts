/**
 * 生き物たち（Ecology）のメソッドを、種・仕組みごとのファイルから集める。
 * クラスの本体（状態と保存しない控え）は src/ecology.ts、メソッドは src/eco/*.ts にあり、ここで読み込むと prototype に足される。
 * Ecology を作る前に、かならずここを読み込む（world.ts が読み込む）。
 */
export * from '../ecology';
import './move';
import './step';
import './undead';
import './wisp';
import './bat';
import './rat';
import './lizard';
import './spider';
import './slime';
import './combat';
import './goblin';
import './orc';
import './lizardman';
import './monsters';
import './statue';
import './vampire';
import './treasure';
import './terrain';
import './breed';
import './groups';
import './sleep';
import './view';
import './senses';
import './islands';
import './log';
import './fire';
import './dragon';
import './adventurer';
import './dwarf';
import './arrivals';
import './myconid';
import './ant';
import './kobold';
import './salamander';
import './save';
