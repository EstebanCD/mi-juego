SECCION,EDIFICIOS
Edificio,Funcion,Notas
Manojo de Arcilla,Edificio raiz evolucionable,Se fortalece por proximidad a otros edificios y elevaciones
Muralla,Defensa por proximidad,Aporta bonus defensivo a edificios adyacentes
Reina,Unico productor de unidades,No se mueve. Objetivo de captura. Produce todo excepto gorgojos

SECCION,UNIDADES
Unidad,HP,ATK,DEF,Regeneracion (HP/s),Capacidad de carga,Coste,Notas
Obrera,20,3,5,0,1 (todos los recursos),5 agua,Motor economico. Domesticа gorgojos
Guerrera,100,15,50,0.5,2 (objetos/cadaveres no recursos),5 agua + 6 glucosa,Combate principal. Mueve cadaveres
Voladora,50,10,5,0,1 (objetos no recursos),4 agua + 4 glucosa,Rapida y fragil. Ataca. Actualizable a Guerrera Voladora
Guerrera Voladora,150,25,50,0.5,2 (objetos no recursos),Guerrera + 3 agua + 8 glucosa,Evolucion de guerrera
Gorgojo,5,0,0,2,0,Domado con 1 glucosa,Solo huye. Inmune a podredumbre. Cura
Reina,1000,10,90 (cap; DEF original 200),0,0,200 agua + 300 glucosa,No se mueve. Produce todo excepto gorgojos

SECCION,GORGOJO - MODOS
Modo,Requisito,Efecto
Recoleccion,Adyacente a flor,+1 carga de glucosa cada 3 seg (max 2)
Curacion,-,+2 HP/s en radio 2. O gastar 1 carga para +15 HP instantaneos a una unidad
Aceleracion,Adyacente a reina + gastar 1 carga,-4% tiempo de produccion de la siguiente hormiga (2 cargas = 8%)

SECCION,GORGOJO - ATRIBUTOS
Atributo,Valor
Movimiento,1 celda cada 2 seg (1.5 seg si lleva glucosa)
Vida,5
Armadura,0
Ataque,0 (solo huye)
Capacidad de glucosa,2 cargas
Coste,Domado con 1 glucosa
Limite,Ilimitado (limitado por flores disponibles)
Al morir,Las cargas caen al suelo como tile recolectable
Inmunidad,Inmune a podredumbre
Habilidad especial,Puede gastar 1 glucosa para curar la enfermedad de una unidad adyacente

SECCION,FLORES Y GLUCOSA
Aspecto,Detalle
Tipo de tile,Tile especial (cuadrado con punto de color: amarillo rosa o blanco)
Recolector,Solo gorgojos
Produce,Glucosa
Se agota,Si tras X extracciones se convierte en flor marchita
Vulnerable,El enemigo puede destruirlas
Uso 1,Recolectar glucosa para modos del gorgojo
Uso 2,Acelerar produccion de la reina (-4% por carga)
Uso 3,Curar una unidad (+15 HP por carga)
Uso 4,Curar enfermedad de una unidad (1 carga)
Uso 5,Desbloquear Guerrera Voladora

SECCION,PODREDUMBRE (SISTEMA GLOBAL)
Fase,Detalle
1. Muerte,Cualquier insecto asesinado deja un cadaver en su celda
2. Espera,Tras X seg (ej. 20) el cadaver emite aura de podredumbre
3. Enfermedad,Insectos en radio 2 se enferman (pierden HP progresivamente)
4. Contagio,Un insecto enfermo contagia a otros en radio 1 durante Y seg
5. Transformacion,Si una unidad enferma baja al 10% de HP se vuelve hostil contra todos
6. Limpieza,El cadaver desaparece tras Z seg (ej. 60) o si alguien lo retira
7. Inmunidad,Los gorgojos son inmunes y pueden curar la enfermedad gastando 1 glucosa

SECCION,GUERRA BIOLOGICA
Estrategia,Descripcion
Zona contaminada,Acumular cadaveres en un paso estrategico para negar el avance enemigo
Guerra biologica,Llevar cadaveres a la base enemiga con guerreras
Limpieza defensiva,Retirar cadaveres de tu propia base antes de que se pudran
Cebo,Dejar un cadaver cerca de un insecto violento para que se enferme y ataque
Control de flores,Contaminar las flores enemigas para enfermar a sus gorgojos

SECCION,ESTILO DE JUEGO
Gana por,Pierde por
Economia basada en obreras y gorgojos,Unidades fragiles en combate directo
Exploracion temprana para domar gorgojos,Perder una reina (catastrofico)
Expansion con nuevas reinas,Defensa debil de edificios
Optimizacion de rutas de glucosa,Dependencia de la curacion del gorgojo
Guerra biologica con cadaveres,Competencia por flores con el enemigo

SECCION,BUCLE DE JUEGO
Paso,Accion
1,Producir obreras en la reina
2,Mover recursos con obreras
3,Explorar el mapa para encontrar flores y gorgojos salvajes
4,Domar gorgojos con obreras (3 seg adyacente)
5,Enviar gorgojos a recolectar glucosa
6,Decidir uso de glucosa (curar / acelerar / desbloquear / curar enfermedad)
7,Producir nueva reina cuando haya recursos
8,Fundar nueva base con la nueva reina
9,Fortificar flores y reinas con murallas
10,Presionar con guerreras y voladoras

SECCION,RELACION CON OTRAS FACCIONES
Vs.,Ventaja de las hormigas,Desventaja de las hormigas
Coleopteros,Expansion rapida y curacion sostenida,Sus edificios son mucho mas resistentes
Avispas,Pueden curarse y aguantar asedios,Las avispas vuelan y hostigan sin ser alcanzadas

SECCION,FORMULA DE COMBATE
Concepto,Formula
Defensa efectiva,DEF_efectiva = min(DEF, 90)
Daño final,Daño = max(1, ATK x (1 - DEF_efectiva/100))


Decisiones:
Victoria: matar a la reina o dejarla sin súbditos.
Reina joven: se mueve, pero solo produce cuando se “planta” en un palacio. Para criar una reina nueva hace falta un segundo palacio.
Arcilla: tiles cerca de flores (más) y en terrenos arcillosos (menos).
Reina: DEF 90, el tope lo aplica la fórmula.
Vista cenital con cuadrícula. La isométrica queda para el final.
Adyacencia: los edificios ganan un pequeño porcentaje de defensa por cada edificio vecino con más defensa que ellos.
