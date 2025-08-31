@extends('backend.layouts.app')

@section('page-title', trans('app.add_article'))
@section('page-heading', trans('app.add_article'))

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">
	<div class="box box-default">
		<form action="{{ route('backend.article.store') }}" method="POST" enctype="multipart/form-data" id="user-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.add_article')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					@include('backend.articles.partials.base', ['edit' => false])
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.add_article')
				</button>
			</div>
		</form>
	</div>
</section>

@stop

@section('scripts')
<script>
	initSample();
</script>
@stop