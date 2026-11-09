/**
 * 生き物たち（Ecology）のメソッドを、種・仕組みごとのファイルから集める。
 * クラスの本体（状態のフィールドと、セーブしないキャッシュ）は src/ecology.ts、メソッドは src/eco/*.ts にあり、ここで import すると prototype に足される。
 * Ecology を作る前に、かならずここを import する（world.ts が import している）。
 */
export * from '../ecology';
import './move';
import './step';
import './thrall';
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
import './aim';
import './raid';
import './night';
import './listen';
import './loot';
import './roster';
import './cache';
import './notes';
import './inspect';
import './dwarf';
import './arrivals';
import './myconid';
import './ant';
import './kobold';
import './salamander';
import './armor';
import './skill';
import './attack';
import './charge';
import './standoff';
import './save';
