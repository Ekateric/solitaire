var gulp = require('gulp'),
	less = require('gulp-less'),
	concat = require('gulp-concat'),
	clean = require('gulp-clean'),
	watch = require('gulp-watch'),
	rename = require('gulp-rename'),
	imagemin = require('gulp-imagemin'),
	newer = require('gulp-newer'),
	pngquant = require('imagemin-pngquant'),
	LessPluginAutoPrefix = require('less-plugin-autoprefix'),

	autoprefix = new LessPluginAutoPrefix({browsers: ["> 5%"]}),

	src = {
		css: '_src/css/**/*',
		less: '_src/css/style.less',
		mainJs: '_src/js/main.js',
		img: '_src/img/**/*'
	},
	build = {
		mainJs: 'main.js'
	};


//Получаем js
gulp.task('mainJs', function() {
	return gulp.src(src.mainJs)
		.pipe(concat('main.js'))
		.pipe(gulp.dest('build/js'))
});

//Получаем css
gulp.task('less', function () {
    return gulp.src(src.less)
        .pipe(less({
            plugins: [autoprefix]
        }))
        .pipe(gulp.dest('build/css'));
});

//Жмем картинки
gulp.task('imagemin', function () {
    return gulp.src(src.img)
        .pipe(newer('build/img'))
        .pipe(imagemin({
            progressive: true,
            svgoPlugins: [{removeViewBox: false}],
            use: [pngquant()]
        }))
        .pipe(gulp.dest('build/img'));
});

// Чистим css & img
gulp.task('clean', function() {
    return gulp.src(['build/css', 'build/img'], {read: false})
        .pipe(clean());
});

// Действия по умолчанию
// Можно раскомментировать clean, чтобы в папке build убрать мусор
gulp.task('default', /*['clean'],*/ function(){
    gulp.start('mainJs', 'less', 'imagemin');

    // Отслеживаем изменения в файлах
    gulp.watch(src.mainJs, ['mainJs']);
    gulp.watch(src.css, ['less']);
    gulp.watch(src.img, ['imagemin']);
});