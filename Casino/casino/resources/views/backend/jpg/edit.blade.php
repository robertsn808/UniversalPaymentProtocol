@extends('backend.layouts.app')

@section('page-title', trans('app.edit_jpg'))
@section('page-heading', $jackpot->title)

@section('content')

<section class="content-header">
	@include('backend.partials.messages')
</section>

<section class="content">

	<div class="box box-default">
		<form action="{{ route('backend.jpgame.update', $jackpot->id) }}" method="POST" enctype="multipart/form-data" id="user-form">
			@csrf
			<div class="box-header with-border">
				<h3 class="box-title">@lang('app.edit_jpg')</h3>
			</div>

			<div class="box-body">
				<div class="row">
					@include('backend.jpg.partials.base', ['edit' => true])
				</div>
			</div>

			<div class="box-footer">
				<button type="submit" class="btn btn-primary">
					@lang('app.edit_jpg')
				</button>

			</div>
		</form>
	</div>
</section>

@stop